import { describe, expect, it } from "@effect/vitest"
import {
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
  String as Str
} from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"

class EncodingConfig extends Data.Class<{ readonly prefix: string }> {}

class EncodingConfigService extends Context.Tag("@scenesystems/digest/test/EncodingConfig")<
  EncodingConfigService,
  EncodingConfig
>() {}

class EncodingDefect extends Schema.TaggedError<EncodingDefect>()("EncodingDefect", {}) {}

const requireEncodingConfig = <A, E>(
  effect: Effect.Effect<A, E, EncodingConfigService>
): Effect.Effect<A, E, EncodingConfigService> => effect

describe("ContentDigest.fromSchema", () => {
  it.effect("hashes the Schema-encoded wire value", () =>
    Effect.gen(function*() {
      const encoded = yield* ContentDigest.fromSchema(Schema.NumberFromString, 42, "sha256")
      const decoded = yield* ContentDigest.fromSchema(Schema.Number, 42, "sha256")

      expect(ContentDigest.toString(encoded)).toBe("sha256:gzTFVMcnb1lnSBC5L_9Rl81Gv2zL6HJ0L5sEyjHf49E")
      expect(ContentDigest.toString(decoded)).toBe("sha256:c0dctApWjo2ooEXO0RATfhWfiQrE2og7axfcZRs6gEk")
      expect(encoded).not.toStrictEqual(decoded)
    }))

  it.effect("defaults to BLAKE3-256", () =>
    Effect.gen(function*() {
      const result = yield* ContentDigest.fromSchema(Schema.String, "value")
      expect(result.algorithm).toBe("blake3-256")
    }))
})

describe("ContentDigest.fromSchemaWithByteLimit", () => {
  it.effect("returns the digest and exact encoded canonical byte length", () =>
    Effect.gen(function*() {
      const digest = yield* ContentDigest.fromSchema(Schema.NumberFromString, 42, "sha256")
      const result = yield* ContentDigest.fromSchemaWithByteLimit(Schema.NumberFromString, 42, 4, "sha256")

      expect(result).toStrictEqual(new ContentDigest.Result({ digest, canonicalByteLength: 4 }))
    }))

  it.effect("rejects invalid limits before Schema encoding", () =>
    Effect.gen(function*() {
      const encoded = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Ref.update(encoded, N.increment).pipe(Effect.as(value))
      })
      const exit = yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(schema, "value", -1))

      expect(exit).toStrictEqual(Exit.fail(new CanonicalJson.InvalidByteLimit({})))
      expect(yield* Ref.get(encoded)).toBe(0)
    }))

  it.effect("defers encoding and runs it once per Effect execution", () =>
    Effect.gen(function*() {
      const encodeCount = yield* Ref.make(0)
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Ref.update(encodeCount, N.increment).pipe(Effect.as(value))
      })
      const operation = ContentDigest.fromSchemaWithByteLimit(schema, "value", 16)

      expect(yield* Ref.get(encodeCount)).toBe(0)
      const first = yield* operation
      expect(yield* operation).toStrictEqual(first)
      expect(yield* Ref.get(encodeCount)).toBe(2)
    }))

  it.effect("preserves Schema service requirements", () =>
    Effect.gen(function*() {
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value) => Effect.map(EncodingConfigService, ({ prefix }) => Str.concat(prefix, value))
      })
      const operation = requireEncodingConfig(
        ContentDigest.fromSchemaWithByteLimit(schema, "value", 15, "sha256")
      )
      const result = yield* operation.pipe(
        Effect.provideService(EncodingConfigService, new EncodingConfig({ prefix: "encoded:" }))
      )

      expect(ContentDigest.toString(result.digest)).toBe(
        "sha256:X4KL-FeuEbbw_GjAT7WTDvaxGvBC6aRO567SQqSHFio"
      )
      expect(result.canonicalByteLength).toBe(15)
    }))

  it.effect("propagates Schema parse failures before canonicalization", () =>
    Effect.gen(function*() {
      const schema = Schema.transformOrFail(Schema.String, Schema.String, {
        strict: true,
        decode: Effect.succeed,
        encode: (value, _, ast) => Effect.fail(new ParseResult.Type(ast, value, "first-party encode failure"))
      })
      const error = yield* Effect.flip(ContentDigest.fromSchemaWithByteLimit(schema, "value", 0))

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

      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(schema, "value", 16))).toStrictEqual(
        Exit.die(defect)
      )
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
      const fiber = yield* ContentDigest.fromSchemaWithByteLimit(schema, "value", 16).pipe(Effect.fork)

      yield* Deferred.await(entered)
      expect(yield* Fiber.interrupt(fiber)).toSatisfy(Exit.isInterrupted)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))
})
