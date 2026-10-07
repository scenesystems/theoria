import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, Number as N, Option, Schema, String as Str, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import * as Fixtures from "../../scripts/fixtures.js"

describe("ContentDigest canonical representations", () => {
  it.effect("matches independent full BLAKE3 digests for ASCII, BMP, astral and mixed values", () =>
    Effect.gen(function*() {
      const fixture = yield* Fixtures.read("jcs-corpus/content-digests.json").pipe(
        Effect.flatMap(Schema.decodeEffect(Fixtures.CanonicalJson))
      )
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const expected = Str.concat("blake3-256:", Option.getOrThrow(Option.fromNullishOr(vector.expectedBlake3)))
          const input = yield* Schema.decodeUnknownEffect(Schema.Json)(vector.input)
          expect(ContentDigest.toString(yield* ContentDigest.fromSchema(Schema.Json, input))).toBe(expected)
          const bytes = yield* Utf8.encode(vector.expectedCanonical)
          const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.Json, input, bytes.byteLength)
          expect(ContentDigest.toString(bounded.digest)).toBe(expected)
          expect(bounded.canonicalByteLength).toBe(bytes.byteLength)
          expect(
            yield* Effect.exit(
              ContentDigest.fromSchemaWithByteLimit(Schema.Json, input, N.decrement(bytes.byteLength))
            )
          ).toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
        }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect.each(Arr.make(
    Tuple.make(Str.concat(Str.repeat(511)("😀"), "x\ud800"), 1023, "lone-high-surrogate"),
    Tuple.make(Str.concat(Str.repeat(512)("😀"), "x\udfff"), 1025, "lone-low-surrogate"),
    Tuple.make(Str.concat(Str.repeat(16_383)("😀"), "x\ud800"), 32767, "lone-high-surrogate"),
    Tuple.make(Str.concat(Str.repeat(16_384)("😀"), "x\udfff"), 32769, "lone-low-surrogate")
  ))(
    "reports exact surrogate indices after valid astral pairs: %s",
    ([text, codeUnitIndex, kind]) =>
      Effect.gen(function*() {
        const expected = Exit.fail(Utf8.InvalidUnicode.make({ kind, codeUnitIndex }))
        expect(yield* Effect.exit(Utf8.encode(text))).toStrictEqual(expected)
        expect(yield* Effect.exit(ContentDigest.fromSchema(Schema.Struct({ text: Schema.String }), { text })))
          .toStrictEqual(expected)
      })
  )

  it.effect("keeps opening-quote byte admission before malformed short-string validation", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, "\ud800", 0)))
        .toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, "\ud800", 1)))
        .toStrictEqual(Exit.fail(new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 })))
    }))

  it.effect("matches the explicit canonical-byte pipeline", () =>
    Effect.gen(function*() {
      const value = { key: "value" }
      const bytes = yield* CanonicalJson.encodeBytes(value)
      const expected = yield* ContentDigest.fromBytes("blake3-256", bytes)
      const actual = yield* ContentDigest.fromSchema(Schema.Struct({ key: Schema.String }), value)

      expect(actual).toStrictEqual(expected)
      expect(ContentDigest.toString(actual)).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("counts every UTF-8 width and escaped control before inclusive admission", () =>
    Effect.gen(function*() {
      const text = "\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff😀\u{10ffff}\n\"\\\u0000\u001f"
      // 25 scalar bytes + 6 short-escape bytes + 12 control-escape bytes + 2 quotes.
      const admitted = yield* ContentDigest.fromSchemaWithByteLimit(Schema.String, text, 45)
      expect(admitted.canonicalByteLength).toBe(45)
      expect(admitted.digest).toStrictEqual(yield* ContentDigest.fromSchema(Schema.String, text))
      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, text, 44)))
        .toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
    }))

  it.effect("retains every ASCII tail across bounded output and final flushes", () =>
    Effect.forEach([32_703, 32_704, 32_705, 32_766, 32_767, 32_768, 65_537], (length) =>
      Effect.gen(function*() {
        const text = Str.repeat(length)("a")
        const expected = Str.concat(Str.concat("\"", text), "\"")
        expect(yield* CanonicalJson.encode(text)).toBe(expected)
        const bytes = yield* Utf8.encode(expected)
        const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.String, text, bytes.byteLength)
        expect(bounded.canonicalByteLength).toBe(bytes.byteLength)
        expect(bounded.digest).toStrictEqual(yield* ContentDigest.fromBytes("blake3-256", bytes))
        expect(
          yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, text, N.decrement(bytes.byteLength)))
        )
          .toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
      })))

  it.effect("keeps reused key layouts independent of member values and later layouts", () =>
    Effect.gen(function*() {
      const input = [
        { z: "last", a: "first" },
        { z: "first", a: "last" },
        { y: { z: 9, a: 2 }, b: 7 },
        { a: "reordered", z: "again" }
      ]
      const expected =
        "[{\"a\":\"first\",\"z\":\"last\"},{\"a\":\"last\",\"z\":\"first\"},{\"b\":7,\"y\":{\"a\":2,\"z\":9}},{\"a\":\"reordered\",\"z\":\"again\"}]"
      expect(yield* CanonicalJson.encode(input)).toBe(expected)
    }))

  it.effect("is deterministic and invariant to record insertion order", () =>
    Effect.gen(function*() {
      const coordinates = Schema.Struct({ a: Schema.Finite, b: Schema.Finite })
      const first = yield* ContentDigest.fromSchema(coordinates, { a: 1, b: 2 })
      const second = yield* ContentDigest.fromSchema(coordinates, { b: 2, a: 1 })

      expect(second).toStrictEqual(first)
      expect(ContentDigest.toString(second)).toBe(ContentDigest.toString(first))
    }))

  it.effect("keeps the selected algorithm in the runtime model and wire string", () =>
    Effect.gen(function*() {
      const value = { items: Arr.make(1, 2, 3), nested: { enabled: true } }
      const schema = Schema.Struct({
        items: Schema.Array(Schema.Finite),
        nested: Schema.Struct({ enabled: Schema.Boolean })
      })
      const blake3 = yield* ContentDigest.fromSchema(schema, value)
      const sha256 = yield* ContentDigest.fromSchema(schema, value, "sha256")

      expect(blake3.algorithm).toBe("blake3-256")
      expect(sha256.algorithm).toBe("sha256")
      expect(ContentDigest.toString(blake3)).not.toBe(ContentDigest.toString(sha256))
    }))

  it.effect("preserves canonicalization failures", () =>
    Effect.gen(function*() {
      expect(
        yield* Effect.exit(
          ContentDigest.fromSchema(Schema.Struct({ key: Schema.Undefined }), { key: undefined }, "sha256")
        )
      ).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" }))
      )
    }))
})
