/**
 * SealedEnvelope and SealAlgorithm schema tests.
 *
 * ### SealAlgorithm
 * - Accepts each valid algorithm literal
 * - Rejects unknown algorithm strings
 *
 * ### SealedEnvelope
 * - Schema.decode accepts valid envelope shapes
 * - Schema.decode rejects missing fields
 * - Schema.decode rejects invalid algorithm literals
 * - Schema.encode produces serializable output
 * - Round-trip: encode → decode preserves all fields
 * - Integrates with Effect.gen via Schema.Class
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { SealAlgorithm } from "../../src/schemas/SealAlgorithm.js"
import { SealedEnvelope } from "../../src/schemas/SealedEnvelope.js"

describe("SealAlgorithm — literal union", () => {
  it("accepts \"xchacha20-poly1305\"", () => {
    const result = Schema.decodeUnknownEither(SealAlgorithm)("xchacha20-poly1305")
    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts \"aes-256-gcm-siv\"", () => {
    const result = Schema.decodeUnknownEither(SealAlgorithm)("aes-256-gcm-siv")
    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts \"aes-256-gcm\"", () => {
    const result = Schema.decodeUnknownEither(SealAlgorithm)("aes-256-gcm")
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects unknown algorithm string", () => {
    const result = Schema.decodeUnknownEither(SealAlgorithm)("chacha20-poly1305")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects non-string input", () => {
    const result = Schema.decodeUnknownEither(SealAlgorithm)(42)
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("SealedEnvelope — Schema.Class", () => {
  it("accepts valid envelope shape via Schema.decodeUnknownEither", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects missing algorithm field", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects missing nonce field", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      ciphertext: "BBBB"
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects missing ciphertext field", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      nonce: "AAAA"
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects invalid algorithm literal", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "rc4",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it.effect("round-trip: encode → decode preserves all fields", () =>
    Effect.gen(function*() {
      const envelope = yield* Schema.decode(SealedEnvelope)({
        algorithm: "xchacha20-poly1305",
        nonce: "AAAA",
        ciphertext: "BBBB"
      })
      const encoded = yield* Schema.encode(SealedEnvelope)(envelope)
      const decoded = yield* Schema.decode(SealedEnvelope)(encoded)
      expect(decoded.algorithm).toBe("xchacha20-poly1305")
      expect(decoded.nonce).toBe("AAAA")
      expect(decoded.ciphertext).toBe("BBBB")
    }))

  it.effect("encode produces serializable output", () =>
    Effect.gen(function*() {
      const envelope = yield* Schema.decode(SealedEnvelope)({
        algorithm: "aes-256-gcm-siv",
        nonce: "CCCC",
        ciphertext: "DDDD"
      })
      const encoded = yield* Schema.encode(SealedEnvelope)(envelope)
      const roundTripped = yield* Schema.decode(SealedEnvelope)(encoded)
      expect(roundTripped.algorithm).toBe("aes-256-gcm-siv")
      expect(roundTripped.nonce).toBe("CCCC")
      expect(roundTripped.ciphertext).toBe("DDDD")
    }))

  it.effect("integrates with Schema.Class construction", () =>
    Effect.gen(function*() {
      const envelope = yield* Schema.decode(SealedEnvelope)({
        algorithm: "xchacha20-poly1305",
        nonce: "AAAA",
        ciphertext: "BBBB"
      })
      expect(envelope.algorithm).toBe("xchacha20-poly1305")
      expect(envelope.nonce).toBe("AAAA")
      expect(envelope.ciphertext).toBe("BBBB")
    }))

  it("accepts xchacha20-poly1305 algorithm", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "xchacha20-poly1305",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts aes-256-gcm-siv algorithm", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "aes-256-gcm-siv",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts aes-256-gcm algorithm", () => {
    const result = Schema.decodeUnknownEither(SealedEnvelope)({
      algorithm: "aes-256-gcm",
      nonce: "AAAA",
      ciphertext: "BBBB"
    })
    expect(Either.isRight(result)).toBe(true)
  })
})
