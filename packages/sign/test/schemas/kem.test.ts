/**
 * KEM schema contract tests.
 *
 * Verifies KemAlgorithm and KemCiphertext Schema.Class
 * validation and round-trip encoding.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { KemAlgorithm } from "../../src/schemas/KemAlgorithm.js"
import { KemCiphertext } from "../../src/schemas/KemCiphertext.js"

describe("KemAlgorithm — literal union", () => {
  it("accepts xwing", () => {
    const result = Schema.decodeUnknownEither(KemAlgorithm)("xwing")
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects ed25519 (signature family)", () => {
    const result = Schema.decodeUnknownEither(KemAlgorithm)("ed25519")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects x25519 (agreement family)", () => {
    const result = Schema.decodeUnknownEither(KemAlgorithm)("x25519")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects unknown algorithm string", () => {
    const result = Schema.decodeUnknownEither(KemAlgorithm)("kyber-512")
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("KemCiphertext — Schema.Class", () => {
  const mockCiphertext = new Uint8Array(1120).fill(0xdd)
  const mockSecret = new Uint8Array(32).fill(0xee)

  it("constructs with algorithm, ciphertext, and sharedSecret", () => {
    const kc = new KemCiphertext({
      algorithm: "xwing",
      ciphertext: mockCiphertext,
      sharedSecret: mockSecret
    })
    expect(kc.algorithm).toBe("xwing")
    expect(kc.ciphertext).toEqual(mockCiphertext)
    expect(kc.sharedSecret).toEqual(mockSecret)
  })

  it.effect("round-trip: encode → decode preserves all fields", () =>
    Effect.gen(function*() {
      const kc = new KemCiphertext({
        algorithm: "xwing",
        ciphertext: mockCiphertext,
        sharedSecret: mockSecret
      })
      const encoded = yield* Schema.encode(KemCiphertext)(kc)
      const decoded = yield* Schema.decode(KemCiphertext)(encoded)
      expect(decoded.algorithm).toBe("xwing")
      expect(decoded.ciphertext).toEqual(mockCiphertext)
      expect(decoded.sharedSecret).toEqual(mockSecret)
    }))

  it("rejects invalid algorithm literal", () => {
    const result = Schema.decodeUnknownEither(KemCiphertext)({
      algorithm: "x25519",
      ciphertext: mockCiphertext,
      sharedSecret: mockSecret
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})
