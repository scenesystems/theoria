import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Exit, Hash, Schema } from "effect"

import * as ContentDigest from "@scenesystems/digest/ContentDigest"

const zeroDigest = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

describe("ContentDigest.Value", () => {
  it.effect("accepts canonical 256-bit unpadded base64url", () => {
    expect(Schema.decodeExit(ContentDigest.Value)(zeroDigest)).toSatisfy(Exit.isSuccess)
    return Effect.void
  })

  it.effect("rejects noncanonical pad bits even when they decode to the same bytes", () => {
    const noncanonical = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB"
    expect(Schema.decodeExit(ContentDigest.Value)(noncanonical)).toSatisfy(Exit.isFailure)
    return Effect.void
  })

  it.effect("rejects wrong lengths and characters", () => {
    expect(Schema.decodeExit(ContentDigest.Value)(zeroDigest.slice(1))).toSatisfy(Exit.isFailure)
    expect(Schema.decodeExit(ContentDigest.Value)(`+${zeroDigest.slice(1)}`)).toSatisfy(Exit.isFailure)
    return Effect.void
  })
})

describe("ContentDigest representation", () => {
  it.effect("round-trips the encoded object and preserves the tagged wire string", () =>
    Effect.gen(function*() {
      const value = yield* Schema.decodeEffect(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })

      expect(yield* Schema.encodeEffect(ContentDigest.ContentDigest)(value)).toStrictEqual({
        algorithm: "sha256",
        digest: zeroDigest
      })
      expect(ContentDigest.toString(value)).toBe(`sha256:${zeroDigest}`)
    }))

  it.effect("has structural equality and hashing semantics", () =>
    Effect.gen(function*() {
      const first = yield* Schema.decodeEffect(ContentDigest.ContentDigest)({
        algorithm: "blake3-256",
        digest: zeroDigest
      })
      const same = yield* Schema.decodeEffect(ContentDigest.ContentDigest)({
        algorithm: "blake3-256",
        digest: zeroDigest
      })
      const different = yield* Schema.decodeEffect(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })

      expect(Equal.equals(first, same)).toBe(true)
      expect(Hash.hash(first)).toBe(Hash.hash(same))
      expect(Equal.equals(first, different)).toBe(false)
    }))

  it.effect("models bounded results as Schema data", () =>
    Effect.gen(function*() {
      const digest = yield* Schema.decodeEffect(ContentDigest.ContentDigest)({
        algorithm: "sha256",
        digest: zeroDigest
      })
      const result = new ContentDigest.Result({ digest, canonicalByteLength: 17 })

      expect(yield* Schema.encodeEffect(ContentDigest.Result)(result)).toStrictEqual({
        digest: { algorithm: "sha256", digest: zeroDigest },
        canonicalByteLength: 17
      })
      const same = yield* Schema.decodeEffect(ContentDigest.Result)({
        digest: { algorithm: "sha256", digest: zeroDigest },
        canonicalByteLength: 17
      })
      const differentLength = new ContentDigest.Result({ digest, canonicalByteLength: 18 })
      const differentDigest = yield* Schema.decodeEffect(ContentDigest.Result)({
        digest: { algorithm: "blake3-256", digest: zeroDigest },
        canonicalByteLength: 17
      })
      expect(Equal.equals(result, same)).toBe(true)
      expect(Hash.hash(result)).toBe(Hash.hash(same))
      expect(Equal.equals(result, differentLength)).toBe(false)
      expect(Equal.equals(result, differentDigest)).toBe(false)
    }))
})
