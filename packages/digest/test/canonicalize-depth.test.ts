import { expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Either, Exit, Number as N, Schema, String as Str, Tuple } from "effect"

import {
  CanonicalByteLimitExceeded,
  canonicalize,
  digestSchemaValueWithByteLimit,
  digestSchemaValueWithByteLimitSync
} from "../src/index.js"

const DEPTH = 100_000
const TEST_TIMEOUT_MILLIS = 30_000

class DeepValueState extends Data.Class<{
  readonly depth: number
  readonly value: unknown
}> {}

const nestedValue = (
  wrap: (value: unknown) => unknown,
  maximumDepth = DEPTH
): Effect.Effect<unknown> =>
  Effect.map(
    Effect.iterate<DeepValueState, never, never>(new DeepValueState({ depth: 0, value: null }), {
      while: ({ depth }) => N.lessThan(depth, maximumDepth),
      body: ({ depth, value }) => Effect.succeed(new DeepValueState({ depth: N.increment(depth), value: wrap(value) }))
    }),
    ({ value }) => value
  )

it.effect("canonicalizes 100000 nested arrays without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue(Arr.of)
    const result = yield* canonicalize(value)
    expect(result).toBe(Arr.join(Arr.make(Str.repeat(DEPTH)("["), "null", Str.repeat(DEPTH)("]")), ""))
  }), TEST_TIMEOUT_MILLIS)

it.effect("canonicalizes 100000 nested records without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue((child) => ({ value: child }))
    const result = yield* canonicalize(value)
    expect(result).toBe(Arr.join(Arr.make(Str.repeat(DEPTH)("{\"value\":"), "null", Str.repeat(DEPTH)("}")), ""))
  }), TEST_TIMEOUT_MILLIS)

class NestedRecord extends Schema.Class<NestedRecord>("NestedRecord")({ value: Schema.Unknown }) {}

const structuralValues = Arr.make(
  Tuple.make("Data.struct", (value: unknown) => Data.struct({ value }), "{\"value\":", "}"),
  Tuple.make("Data.array", (value: unknown) => Data.array(Arr.of(value)), "[", "]"),
  Tuple.make("Schema.Class", (value: unknown) => new NestedRecord({ value }), "{\"value\":", "}")
)

it.effect.each(structuralValues)(
  "canonicalizes deep %s without structural hashing",
  ([, wrap, open, close]) =>
    Effect.gen(function*() {
      const depth = 10_000
      const value = yield* nestedValue(wrap, depth)
      expect(yield* canonicalize(value)).toBe(
        Arr.join(Arr.make(Str.repeat(depth)(open), "null", Str.repeat(depth)(close)), "")
      )
    }),
  TEST_TIMEOUT_MILLIS
)

it.effect.each(structuralValues)(
  "rejects a zero-byte limit before descending into deep %s",
  ([, wrap]) =>
    Effect.gen(function*() {
      const value = yield* nestedValue(wrap, 10_000)
      const expected = new CanonicalByteLimitExceeded({})
      expect(yield* Effect.exit(digestSchemaValueWithByteLimit(Schema.Unknown, value, 0))).toStrictEqual(
        Exit.fail(expected)
      )
      expect(digestSchemaValueWithByteLimitSync(Schema.Unknown, value, 0)).toStrictEqual(Either.left(expected))
    }),
  TEST_TIMEOUT_MILLIS
)
