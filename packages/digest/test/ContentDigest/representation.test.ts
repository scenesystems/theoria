import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Equal, Hash, Schema } from "effect"

import * as ContentDigest from "@scenesystems/digest/ContentDigest"

const zeroDigest = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

describe("ContentDigest.Value", () => {
  it.effect("accepts canonical 256-bit unpadded base64url", () => {
    expect(Schema.decodeUnknownEither(ContentDigest.Value)(zeroDigest)).toSatisfy(Either.isRight)
    return Effect.void
  })

  it.effect("rejects noncanonical pad bits even when they decode to the same bytes", () => {
    const noncanonical = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB"
    expect(Schema.decodeUnknownEither(ContentDigest.Value)(noncanonical)).toSatisfy(Either.isLeft)
    return Effect.void
  })

  it.effect("rejects wrong lengths and characters", () => {
    expect(Schema.decodeUnknownEither(ContentDigest.Value)(zeroDigest.slice(1))).toSatisfy(Either.isLeft)
    expect(Schema.decodeUnknownEither(ContentDigest.Value)(`+${zeroDigest.slice(1)}`)).toSatisfy(Either.isLeft)
    return Effect.void
  })
})

describe("ContentDigest representation", () => {
  it.effect("round-trips the encoded object and preserves the tagged wire string", () =>
    Effect.gen(function*() {
      const value = yield* Schema.decodeUnknown(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })

      expect(yield* Schema.encode(ContentDigest.ContentDigest)(value)).toStrictEqual({
        algorithm: "sha256",
        digest: zeroDigest
      })
      expect(ContentDigest.toString(value)).toBe(`sha256:${zeroDigest}`)
    }))

  it.effect("has structural equality and hashing semantics", () =>
    Effect.gen(function*() {
      const first = yield* Schema.decodeUnknown(ContentDigest.ContentDigest)({
        algorithm: "blake3-256",
        digest: zeroDigest
      })
      const same = yield* Schema.decodeUnknown(ContentDigest.ContentDigest)({
        algorithm: "blake3-256",
        digest: zeroDigest
      })
      const different = yield* Schema.decodeUnknown(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })

      expect(Equal.equals(first, same)).toBe(true)
      expect(Hash.hash(first)).toBe(Hash.hash(same))
      expect(Equal.equals(first, different)).toBe(false)
    }))

  it.effect("models bounded results as Schema data", () =>
    Effect.gen(function*() {
      const digest = yield* Schema.decodeUnknown(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })
      const result = new ContentDigest.Result({ digest, canonicalByteLength: 17 })

      expect(yield* Schema.encode(ContentDigest.Result)(result)).toStrictEqual({
        digest: { algorithm: "sha256", digest: zeroDigest },
        canonicalByteLength: 17
      })
    }))
})
