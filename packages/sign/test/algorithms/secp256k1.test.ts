/**
 * secp256k1 ECDSA and Schnorr contract tests.
 *
 * Verifies:
 * - ECDSA sign → verify roundtrip
 * - Schnorr (BIP-340) sign → verify roundtrip
 * - ECDSA deterministic signing (RFC 6979)
 * - Invalid signature rejection for both schemes
 * - Wrong public key rejection
 * - 64-byte compact signatures
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import {
  secp256k1EcdsaKeygen,
  secp256k1EcdsaSign,
  secp256k1EcdsaVerify,
  secp256k1SchnorrKeygen,
  secp256k1SchnorrSign,
  secp256k1SchnorrVerify
} from "../../src/algorithms/secp256k1.js"

describe("secp256k1 ECDSA — algorithm contracts", () => {
  const message = new TextEncoder().encode("hello secp256k1")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      const sig = yield* secp256k1EcdsaSign(message, kp.secretKey, kp.publicKey)
      const valid = yield* secp256k1EcdsaVerify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("deterministic signing (RFC 6979)", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      const sig1 = yield* secp256k1EcdsaSign(message, kp.secretKey, kp.publicKey)
      const sig2 = yield* secp256k1EcdsaSign(message, kp.secretKey, kp.publicKey)
      expect(sig1.signature).toEqual(sig2.signature)
    }))

  it.effect("produces 64-byte compact signatures", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      const sig = yield* secp256k1EcdsaSign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      const sig = yield* secp256k1EcdsaSign(message, kp.secretKey, kp.publicKey)
      const tampered = new Uint8Array(sig.signature)
      tampered[0] = tampered[0]! ^ 0xff
      const valid = yield* secp256k1EcdsaVerify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* secp256k1EcdsaKeygen()
      const kp2 = yield* secp256k1EcdsaKeygen()
      const sig = yield* secp256k1EcdsaSign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* secp256k1EcdsaVerify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("generates 32-byte secret key and 33-byte compressed public key", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(33)
      expect(kp.algorithm).toBe("secp256k1-ecdsa")
    }))
})

describe("secp256k1 Schnorr (BIP-340) — algorithm contracts", () => {
  const message = new TextEncoder().encode("hello schnorr")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1SchnorrKeygen()
      const sig = yield* secp256k1SchnorrSign(message, kp.secretKey, kp.publicKey)
      const valid = yield* secp256k1SchnorrVerify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("produces 64-byte signatures", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1SchnorrKeygen()
      const sig = yield* secp256k1SchnorrSign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1SchnorrKeygen()
      const sig = yield* secp256k1SchnorrSign(message, kp.secretKey, kp.publicKey)
      const tampered = new Uint8Array(sig.signature)
      tampered[0] = tampered[0]! ^ 0xff
      const valid = yield* secp256k1SchnorrVerify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("generates 32-byte x-only public key", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1SchnorrKeygen()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("secp256k1-schnorr")
    }))
})
