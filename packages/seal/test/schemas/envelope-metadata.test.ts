import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import { SealedEnvelope } from "../../src/schemas/SealedEnvelope.js"

describe("SealedEnvelope metadata", () => {
  it("accepts additive key metadata without breaking the existing envelope shape", () => {
    const withMetadata = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      nonce: "AAAA",
      ciphertext: "BBBB",
      keyId: "active-root-key",
      keyVersion: 7
    })
    const withoutMetadata = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })

    expect(Either.isRight(withMetadata)).toBe(true)
    expect(Either.isRight(withoutMetadata)).toBe(true)
  })

  it.effect("round-trips additive key metadata through Schema.encode and Schema.decode", () =>
    Effect.gen(function*() {
      const envelope = yield* Schema.decode(SealedEnvelope)({
        algorithm: "aes-256-gcm-siv",
        nonce: "CCCC",
        ciphertext: "DDDD",
        keyId: "tenant-a",
        keyVersion: 3
      })

      const encoded = yield* Schema.encode(SealedEnvelope)(envelope)
      const decoded = yield* Schema.decode(SealedEnvelope)(encoded)

      expect(decoded.keyId).toBe("tenant-a")
      expect(decoded.keyVersion).toBe(3)
    }))
})
