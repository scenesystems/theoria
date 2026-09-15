/**
 * Native Effect Schema encoding contracts for Schema-defined digest preimages.
 */

import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Context,
  Data,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Number as N,
  ParseResult,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"

import {
  CanonicalByteLimitExceeded,
  digestSchemaValue,
  digestSchemaValueWithByteLimit,
  InvalidCanonicalByteLimit,
  SchemaValueDigest
} from "../src/index.js"

const canonicalByteCountCases = Arr.make(
  Tuple.make("A", 3),
  Tuple.make("é", 4),
  Tuple.make("€", 5),
  Tuple.make("😀", 6),
  Tuple.make("\n", 4),
  Tuple.make("\u0000", 8),
  Tuple.make("\\\"", 6),
  Tuple.make("é😀\n", 10)
)

class EncodingConfig extends Data.Class<{ readonly prefix: string }> {}

class EncodingConfigService extends Context.Tag("@scenesystems/digest/test/EncodingConfig")<
  EncodingConfigService,
  EncodingConfig
>() {}

class EncodingDefect extends Schema.TaggedError<EncodingDefect>()("EncodingDefect", {}) {}

const requireEncodingConfig = <A, E>(
  effect: Effect.Effect<A, E, EncodingConfigService>
): Effect.Effect<A, E, EncodingConfigService> => effect

describe("digestSchemaValue", () => {
  it.effect("hashes the Schema-encoded preimage with an independent SHA-256 known answer", () =>
    Effect.gen(function*() {
      const encoded = yield* digestSchemaValue(Schema.NumberFromString, 42, "sha256")
      const decoded = yield* digestSchemaValue(Schema.Number, 42, "sha256")

      expect(encoded).toBe("sha256:gzTFVMcnb1lnSBC5L_9Rl81Gv2zL6HJ0L5sEyjHf49E")
      expect(decoded).toBe("sha256:c0dctApWjo2ooEXO0RATfhWfiQrE2og7axfcZRs6gEk")
      expect(encoded).not.toBe(decoded)
    }))

  it.effect("selects the requested algorithm and defaults to BLAKE3-256", () =>
    Effect.gen(function*() {
      const defaultDigest = yield* digestSchemaValue(Schema.String, "value")
      const sha256Digest = yield* digestSchemaValue(Schema.String, "value", "sha256")

      expect(Str.startsWith("blake3-256:")(defaultDigest)).toBe(true)
      expect(Str.startsWith("sha256:")(sha256Digest)).toBe(true)
      expect(defaultDigest).not.toBe(sha256Digest)
    }))
})

describe("digestSchemaValueWithByteLimit", () => {
  it.effect("uses the encoded value for the bounded preimage and both algorithms", () =>
    Effect.gen(function*() {
      const blake3 = yield* digestSchemaValue(Schema.NumberFromString, 42, "blake3-256")
      const boundedBlake3 = yield* digestSchemaValueWithByteLimit(
        Schema.NumberFromString,
        42,
        4,
        "blake3-256"
      )
      const sha256 = yield* digestSchemaValue(Schema.NumberFromString, 42, "sha256")
      const boundedSha256 = yield* digestSchemaValueWithByteLimit(Schema.NumberFromString, 42, 4, "sha256")

      expect(boundedBlake3).toStrictEqual(
        new SchemaValueDigest({ digest: blake3, canonicalByteLength: 4 })
      )
      expect(boundedSha256).toStrictEqual(
        new SchemaValueDigest({ digest: sha256, canonicalByteLength: 4 })
      )
    }))

  it.effect.each(canonicalByteCountCases)(
    "enforces the inclusive UTF-8 boundary for multibyte and escaped text %#",
    ([value, canonicalByteLength]) =>
      Effect.gen(function*() {
        const exact = yield* digestSchemaValueWithByteLimit(Schema.String, value, canonicalByteLength)
        const excess = yield* Effect.exit(
          digestSchemaValueWithByteLimit(Schema.String, value, N.decrement(canonicalByteLength))
        )

        expect(exact.canonicalByteLength).toBe(canonicalByteLength)
        expect(excess).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
      })
  )

  it.effect("rejects an invalid byte limit before encoding", () =>
    Effect.gen(function*() {
      const encoded = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Ref.update(encoded, N.increment).pipe(Effect.as(value))
      })
      const exit = yield* digestSchemaValueWithByteLimit(schema, "value", -1).pipe(Effect.exit)

      expect(exit).toStrictEqual(Exit.fail(new InvalidCanonicalByteLimit({})))
      expect(yield* Ref.get(encoded)).toBe(0)
    }))

  it.effect("defers encoding and runs it exactly once per Effect execution", () =>
    Effect.gen(function*() {
      const encodeCount = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Ref.update(encodeCount, N.increment).pipe(Effect.as(value))
      })
      const operation = digestSchemaValueWithByteLimit(schema, "value", 16)

      expect(yield* Ref.get(encodeCount)).toBe(0)
      const first = yield* operation
      const second = yield* operation

      expect(second).toStrictEqual(first)
      expect(yield* Ref.get(encodeCount)).toBe(2)
    }))

  it.effect("preserves Schema encoding requirements in the returned Effect", () =>
    Effect.gen(function*() {
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Effect.map(EncodingConfigService, ({ prefix }) => Str.concat(prefix, value))
      })
      const operation = requireEncodingConfig(
        digestSchemaValueWithByteLimit(schema, "value", 15, "sha256")
      )
      const result = yield* operation.pipe(
        Effect.provideService(EncodingConfigService, new EncodingConfig({ prefix: "encoded:" }))
      )

      expect(result).toStrictEqual(
        new SchemaValueDigest({
          digest: "sha256:X4KL-FeuEbbw_GjAT7WTDvaxGvBC6aRO567SQqSHFio",
          canonicalByteLength: 15
        })
      )
    }))

  it.effect("propagates a first-party Schema encoding failure before canonicalization", () =>
    Effect.gen(function*() {
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value, _, ast) => Effect.fail(new ParseResult.Type(ast, value, "first-party encode failure"))
      })
      const error = yield* digestSchemaValueWithByteLimit(schema, "value", 0).pipe(Effect.flip)

      expect(error._tag).toBe("ParseError")
      expect(error.message).toContain("first-party encode failure")
    }))

  it.effect("preserves defects from effectful Schema encoding", () =>
    Effect.gen(function*() {
      const defect = new EncodingDefect({})
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: () => Effect.die(defect)
      })
      const exit = yield* digestSchemaValueWithByteLimit(schema, "value", 16).pipe(Effect.exit)

      expect(exit).toStrictEqual(Exit.die(defect))
    }))

  it.effect("interrupts effectful Schema encoding and runs its finalizer", () =>
    Effect.gen(function*() {
      const entered = yield* Deferred.make<void>()
      const finalized = yield* Ref.make(false)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: () =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.zipRight(Effect.never),
            Effect.ensuring(Ref.set(finalized, true))
          )
      })
      const fiber = yield* digestSchemaValueWithByteLimit(schema, "value", 16).pipe(Effect.fork)

      yield* Deferred.await(entered)
      const exit = yield* Fiber.interrupt(fiber)

      expect(exit).toSatisfy(Exit.isInterrupted)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))
})
