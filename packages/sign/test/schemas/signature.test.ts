/**
 * Schema-layer type contract tests.
 *
 * Verifies algorithm literal schemas validate correct values and
 * reject cross-family values, and that Schema.Class types
 * round-trip through encode/decode.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { KeyPair } from "../../src/schemas/KeyPair.js"
import { Signature } from "../../src/schemas/Signature.js"
import { SignatureAlgorithm } from "../../src/schemas/SignatureAlgorithm.js"

const ALL_SIGNATURE_ALGORITHMS = SignatureAlgorithm.literals

describe("SignatureAlgorithm — literal union", () => {
  it.each(ALL_SIGNATURE_ALGORITHMS)("accepts %s", (alg) => {
    const result = Schema.decodeUnknownEither(SignatureAlgorithm)(alg)
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects x25519 (agreement family)", () => {
    const result = Schema.decodeUnknownEither(SignatureAlgorithm)("x25519")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects xwing (KEM family)", () => {
    const result = Schema.decodeUnknownEither(SignatureAlgorithm)("xwing")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects unknown algorithm string", () => {
    const result = Schema.decodeUnknownEither(SignatureAlgorithm)("rsa-2048")
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("Signature — Schema.Class", () => {
  const mockSig = new Uint8Array(64).fill(0xaa)
  const mockPk = new Uint8Array(32).fill(0xbb)

  it("constructs with valid algorithm", () => {
    const sig = new Signature({
      algorithm: "ed25519",
      signature: mockSig,
      publicKey: mockPk
    })
    expect(sig.algorithm).toBe("ed25519")
    expect(sig.signature).toEqual(mockSig)
    expect(sig.publicKey).toEqual(mockPk)
  })

  it.effect("round-trip: encode → decode preserves all fields", () =>
    Effect.gen(function*() {
      const sig = new Signature({
        algorithm: "ml-dsa-65",
        signature: mockSig,
        publicKey: mockPk
      })
      const encoded = yield* Schema.encode(Signature)(sig)
      const decoded = yield* Schema.decode(Signature)(encoded)
      expect(decoded.algorithm).toBe("ml-dsa-65")
      expect(decoded.signature).toEqual(mockSig)
      expect(decoded.publicKey).toEqual(mockPk)
    }))

  it("rejects invalid algorithm literal", () => {
    const result = Schema.decodeUnknownEither(Signature)({
      algorithm: "x25519",
      signature: mockSig,
      publicKey: mockPk
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("KeyPair — Schema.Class", () => {
  const mockSk = new Uint8Array(32).fill(0x11)
  const mockPk = new Uint8Array(32).fill(0x22)

  it("constructs with algorithm, publicKey, secretKey", () => {
    const kp = new KeyPair({
      algorithm: "ed25519",
      publicKey: mockPk,
      secretKey: mockSk
    })
    expect(kp.algorithm).toBe("ed25519")
    expect(kp.publicKey).toEqual(mockPk)
    expect(kp.secretKey).toEqual(mockSk)
  })

  it.effect("round-trip: encode → decode preserves all fields", () =>
    Effect.gen(function*() {
      const kp = new KeyPair({
        algorithm: "x25519",
        publicKey: mockPk,
        secretKey: mockSk
      })
      const encoded = yield* Schema.encode(KeyPair)(kp)
      const decoded = yield* Schema.decode(KeyPair)(encoded)
      expect(decoded.algorithm).toBe("x25519")
      expect(decoded.publicKey).toEqual(mockPk)
      expect(decoded.secretKey).toEqual(mockSk)
    }))
})
