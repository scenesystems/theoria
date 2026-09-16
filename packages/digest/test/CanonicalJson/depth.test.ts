import { expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Either, Exit, Number as N, Schema, String as Str, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"

const maximumDepth = 100_000
const testTimeoutMillis = 30_000

class DeepValueState extends Data.Class<{
  readonly depth: number
  readonly value: unknown
}> {}

const nestedValue = (
  wrap: (value: unknown) => unknown,
  depthLimit = maximumDepth
): Effect.Effect<unknown> =>
  Effect.map(
    Effect.iterate<DeepValueState, never, never>(new DeepValueState({ depth: 0, value: null }), {
      while: ({ depth }) => N.lessThan(depth, depthLimit),
      body: ({ depth, value }) => Effect.succeed(new DeepValueState({ depth: N.increment(depth), value: wrap(value) }))
    }),
    ({ value }) => value
  )

it.effect("canonicalizes 100000 nested arrays without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue(Arr.of)
    const result = yield* CanonicalJson.encode(value)
    expect(result).toBe(Arr.join(Arr.make(Str.repeat(maximumDepth)("["), "null", Str.repeat(maximumDepth)("]")), ""))
  }), testTimeoutMillis)

it.effect("canonicalizes 100000 nested records without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue((child) => ({ value: child }))
    const result = yield* CanonicalJson.encode(value)
    expect(result).toBe(
      Arr.join(Arr.make(Str.repeat(maximumDepth)("{\"value\":"), "null", Str.repeat(maximumDepth)("}")), "")
    )
  }), testTimeoutMillis)

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
      expect(yield* CanonicalJson.encode(value)).toBe(
        Arr.join(Arr.make(Str.repeat(depth)(open), "null", Str.repeat(depth)(close)), "")
      )
    }),
  testTimeoutMillis
)

it.effect.each(structuralValues)(
  "rejects a zero-byte limit before descending into deep %s",
  ([, wrap]) =>
    Effect.gen(function*() {
      const value = yield* nestedValue(wrap, 10_000)
      const expected = new CanonicalJson.ByteLimitExceeded({})
      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, value, 0))).toStrictEqual(
        Exit.fail(expected)
      )
      expect(ContentDigest.fromSchemaWithByteLimitEither(Schema.Unknown, value, 0)).toStrictEqual(
        Either.left(expected)
      )
    }),
  testTimeoutMillis
)
