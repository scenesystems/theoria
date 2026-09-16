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
import { Bytes, Entropy, Secp256k1 } from "@scenesystems/sign"
import { Array as Arr, Effect, Number as N, Schema } from "effect"

describe("secp256k1 ECDSA — algorithm contracts", () => {
  const message = Bytes.fromString("hello secp256k1")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateEcdsaKeyPair()
      const sig = yield* Secp256k1.signEcdsa(message, kp.secretKey, kp.publicKey)
      const valid = yield* Secp256k1.verifyEcdsa(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("deterministic signing (RFC 6979)", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateEcdsaKeyPair()
      const sig1 = yield* Secp256k1.signEcdsa(message, kp.secretKey, kp.publicKey)
      const sig2 = yield* Secp256k1.signEcdsa(message, kp.secretKey, kp.publicKey)
      expect(sig1.signature).toEqual(sig2.signature)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("produces 64-byte compact signatures", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateEcdsaKeyPair()
      const sig = yield* Secp256k1.signEcdsa(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateEcdsaKeyPair()
      const sig = yield* Secp256k1.signEcdsa(message, kp.secretKey, kp.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(sig.signature), 0, (byte) => N.remainder(N.increment(byte), 256))
      )
      const valid = yield* Secp256k1.verifyEcdsa(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* Secp256k1.generateEcdsaKeyPair()
      const kp2 = yield* Secp256k1.generateEcdsaKeyPair()
      const sig = yield* Secp256k1.signEcdsa(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* Secp256k1.verifyEcdsa(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("generates 32-byte secret key and 33-byte compressed public key", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateEcdsaKeyPair()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(33)
      expect(kp.algorithm).toBe("secp256k1-ecdsa")
    }).pipe(Effect.provide(Entropy.layer)))
})

describe("secp256k1 Schnorr (BIP-340) — algorithm contracts", () => {
  const message = Bytes.fromString("0123456789abcdef0123456789abcdef")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateSchnorrKeyPair()
      const sig = yield* Secp256k1.signSchnorr(message, kp.secretKey, kp.publicKey)
      const valid = yield* Secp256k1.verifySchnorr(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("produces 64-byte signatures", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateSchnorrKeyPair()
      const sig = yield* Secp256k1.signSchnorr(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateSchnorrKeyPair()
      const sig = yield* Secp256k1.signSchnorr(message, kp.secretKey, kp.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(sig.signature), 0, (byte) => N.remainder(N.increment(byte), 256))
      )
      const valid = yield* Secp256k1.verifySchnorr(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("generates 32-byte x-only public key", () =>
    Effect.gen(function*() {
      const kp = yield* Secp256k1.generateSchnorrKeyPair()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("secp256k1-schnorr")
    }).pipe(Effect.provide(Entropy.layer)))
})
