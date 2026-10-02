import { expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Exit, Schema, String as Str, Tuple } from "effect"

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
  Effect.suspend(() => {
    const build = (state: DeepValueState): Effect.Effect<unknown> =>
      state.depth < depthLimit
        ? Effect.suspend(() => build(new DeepValueState({ depth: state.depth + 1, value: wrap(state.value) })))
        : Effect.succeed(state.value)
    return build(new DeepValueState({ depth: 0, value: null }))
  })

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
class NestedData extends Data.Class<{ readonly value: unknown }> {}

const structuralValues = Arr.make(
  Tuple.make("Data.Class", (value: unknown) => new NestedData({ value }), "{\"value\":", "}"),
  Tuple.make("Array", (value: unknown) => Arr.of(value), "[", "]"),
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
    }),
  testTimeoutMillis
)
