/**
 * Agreement schema contract tests.
 *
 * Verifies AgreementAlgorithm and SharedSecret Schema.Class
 * validation and round-trip encoding.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { AgreementAlgorithm } from "../../src/schemas/AgreementAlgorithm.js"
import { SharedSecret } from "../../src/schemas/SharedSecret.js"

describe("AgreementAlgorithm — literal union", () => {
  it("accepts x25519", () => {
    const result = Schema.decodeUnknownEither(AgreementAlgorithm)("x25519")
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects ed25519 (signature family)", () => {
    const result = Schema.decodeUnknownEither(AgreementAlgorithm)("ed25519")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects xwing (KEM family)", () => {
    const result = Schema.decodeUnknownEither(AgreementAlgorithm)("xwing")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects unknown algorithm string", () => {
    const result = Schema.decodeUnknownEither(AgreementAlgorithm)("dh-2048")
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("SharedSecret — Schema.Class", () => {
  const mockSecret = new Uint8Array(32).fill(0xcc)

  it("constructs with algorithm and sharedSecret", () => {
    const ss = new SharedSecret({
      algorithm: "x25519",
      sharedSecret: mockSecret
    })
    expect(ss.algorithm).toBe("x25519")
    expect(ss.sharedSecret).toEqual(mockSecret)
  })

  it.effect("round-trip: encode → decode preserves all fields", () =>
    Effect.gen(function*() {
      const ss = new SharedSecret({
        algorithm: "x25519",
        sharedSecret: mockSecret
      })
      const encoded = yield* Schema.encode(SharedSecret)(ss)
      const decoded = yield* Schema.decode(SharedSecret)(encoded)
      expect(decoded.algorithm).toBe("x25519")
      expect(decoded.sharedSecret).toEqual(mockSecret)
    }))

  it("rejects invalid algorithm literal", () => {
    const result = Schema.decodeUnknownEither(SharedSecret)({
      algorithm: "ed25519",
      sharedSecret: mockSecret
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})
