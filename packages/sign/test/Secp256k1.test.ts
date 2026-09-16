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
import { Array as Arr, Data, Effect, Encoding, Layer, Number as N, Schema, Tuple } from "effect"
import { PublicSignatureKatFixture } from "../scripts/fixture-contract.js"
import katCorpus from "./fixtures/conformance/sign-public-kat.json" with { type: "json" }

const deterministicEntropy = (entropy: Uint8Array) =>
  Layer.succeed(
    Entropy.Entropy,
    Data.struct({
      bytes: (length: number) =>
        Effect.succeed(entropy).pipe(
          Effect.filterOrFail(
            (bytes) => N.Equivalence(bytes.length, length),
            () => new Entropy.GenerationFailed({ length, reason: "unexpected deterministic entropy request" })
          )
        )
    })
  )

describe("secp256k1 independent conformance", () => {
  it.effect("accepts and rejects pinned Wycheproof ECDSA P1363 vectors", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(PublicSignatureKatFixture))(katCorpus)
      yield* Effect.forEach(fixture.secp256k1.ecdsa, (vector) =>
        Effect.gen(function*() {
          const signature = yield* Encoding.decodeHex(vector.signature)
          const message = yield* Encoding.decodeHex(vector.message)
          const publicKey = yield* Encoding.decodeHex(vector.publicKey)
          expect(yield* Secp256k1.verifyEcdsa(signature, message, publicKey)).toBe(vector.expected)
        }))
    }))

  it.effect("reproduces BIP-340 vector 0 with deterministic auxiliary randomness", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(PublicSignatureKatFixture))(katCorpus)
      const vector = Tuple.getFirst(fixture.secp256k1.bip340)
      const secretKey = yield* Encoding.decodeHex(vector.secretKey)
      const publicKey = yield* Encoding.decodeHex(vector.publicKey)
      const auxiliaryRandomness = yield* Encoding.decodeHex(vector.auxiliaryRandomness)
      const message = yield* Encoding.decodeHex(vector.message)
      const signed = yield* Secp256k1.signSchnorr(message, secretKey, publicKey).pipe(
        Effect.provide(deterministicEntropy(auxiliaryRandomness))
      )
      expect(Encoding.encodeHex(signed.signature)).toBe(Encoding.encodeHex(yield* Encoding.decodeHex(vector.signature)))
      expect(yield* Secp256k1.verifySchnorr(signed.signature, message, publicKey)).toBe(true)
    }))

  it.effect("rejects the official BIP-340 negated-message signature", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(PublicSignatureKatFixture))(katCorpus)
      const vector = Tuple.getSecond(fixture.secp256k1.bip340)
      const signature = yield* Encoding.decodeHex(vector.signature)
      const message = yield* Encoding.decodeHex(vector.message)
      const publicKey = yield* Encoding.decodeHex(vector.publicKey)
      expect(yield* Secp256k1.verifySchnorr(signature, message, publicKey)).toBe(false)
    }))
})

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
