import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, Option, Schema, String as Str, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import * as Fixtures from "../../scripts/fixtures.js"

describe("ContentDigest.fromUnknown", () => {
  it.effect("matches independent full BLAKE3 digests for ASCII, BMP, astral and mixed values", () =>
    Effect.gen(function*() {
      const fixture = yield* Fixtures.read("jcs-corpus/content-digests.json").pipe(
        Effect.flatMap(Schema.decodeEffect(Fixtures.CanonicalJson))
      )
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const expected = Str.concat("blake3-256:", Option.getOrThrow(Option.fromNullishOr(vector.expectedBlake3)))
          expect(ContentDigest.toString(yield* ContentDigest.fromUnknown("blake3-256", vector.input))).toBe(expected)
          const bytes = yield* Utf8.encode(vector.expectedCanonical)
          const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, vector.input, bytes.byteLength)
          expect(ContentDigest.toString(bounded.digest)).toBe(expected)
          expect(bounded.canonicalByteLength).toBe(bytes.byteLength)
          expect(
            yield* Effect.exit(
              ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, vector.input, bytes.byteLength - 1)
            )
          ).toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
        }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect.each(Arr.make(
    Tuple.make(Str.concat(Str.repeat(511)("😀"), "x\ud800"), 1023, "lone-high-surrogate"),
    Tuple.make(Str.concat(Str.repeat(512)("😀"), "x\udfff"), 1025, "lone-low-surrogate")
  ))(
    "reports exact surrogate indices after valid astral pairs: %s",
    ([text, codeUnitIndex, kind]) =>
      Effect.gen(function*() {
        const expected = Exit.fail(Utf8.InvalidUnicode.make({ kind, codeUnitIndex }))
        expect(yield* Effect.exit(Utf8.encode(text))).toStrictEqual(expected)
        expect(yield* Effect.exit(ContentDigest.fromUnknown("blake3-256", { text }))).toStrictEqual(expected)
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
      const actual = yield* ContentDigest.fromUnknown("blake3-256", value)

      expect(actual).toStrictEqual(expected)
      expect(ContentDigest.toString(actual)).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("is deterministic and invariant to record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* ContentDigest.fromUnknown("blake3-256", { a: 1, b: 2 })
      const second = yield* ContentDigest.fromUnknown("blake3-256", { b: 2, a: 1 })

      expect(second).toStrictEqual(first)
      expect(ContentDigest.toString(second)).toBe(ContentDigest.toString(first))
    }))

  it.effect("keeps the selected algorithm in the runtime model and wire string", () =>
    Effect.gen(function*() {
      const value = { items: Arr.make(1, 2, 3), nested: { enabled: true } }
      const blake3 = yield* ContentDigest.fromUnknown("blake3-256", value)
      const sha256 = yield* ContentDigest.fromUnknown("sha256", value)

      expect(blake3.algorithm).toBe("blake3-256")
      expect(sha256.algorithm).toBe("sha256")
      expect(ContentDigest.toString(blake3)).not.toBe(ContentDigest.toString(sha256))
    }))

  it.effect("preserves canonicalization failures", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(ContentDigest.fromUnknown("sha256", { key: undefined }))).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" }))
      )
    }))
})
