/**
 * Ed25519 algorithm contract tests.
 *
 * Verifies:
 * - Deterministic signing (identical inputs → identical signatures)
 * - 64-byte signature output shape
 * - Sign → verify roundtrip for random messages
 * - Invalid signature rejection
 * - Wrong public key rejection
 * - Empty message signing and verification
 */
import { describe, expect, it } from "@effect/vitest"
import { Bytes, Ed25519, Entropy } from "@scenesystems/sign"
import { Array as Arr, Effect, Encoding, Number as N, Schema } from "effect"

describe("Ed25519 — algorithm contracts", () => {
  const message = Bytes.fromString("hello noble")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      const sig = yield* Ed25519.sign(message, kp.secretKey, kp.publicKey)
      const valid = yield* Ed25519.verify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("produces 64-byte signatures", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      const sig = yield* Ed25519.sign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("deterministic signing — identical inputs produce identical signatures", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      const sig1 = yield* Ed25519.sign(message, kp.secretKey, kp.publicKey)
      const sig2 = yield* Ed25519.sign(message, kp.secretKey, kp.publicKey)
      expect(sig1.signature).toEqual(sig2.signature)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      const sig = yield* Ed25519.sign(message, kp.secretKey, kp.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(sig.signature), 32, (byte) => N.remainder(N.increment(byte), 256))
      )
      const valid = yield* Ed25519.verify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* Ed25519.generateKeyPair()
      const kp2 = yield* Ed25519.generateKeyPair()
      const sig = yield* Ed25519.sign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* Ed25519.verify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("signs and verifies empty message", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      const empty = yield* Encoding.decodeHex("")
      const sig = yield* Ed25519.sign(empty, kp.secretKey, kp.publicKey)
      const valid = yield* Ed25519.verify(sig.signature, empty, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("generates 32-byte keys", () =>
    Effect.gen(function*() {
      const kp = yield* Ed25519.generateKeyPair()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("ed25519")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* Ed25519.generateKeyPair()
      const kp2 = yield* Ed25519.generateKeyPair()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})
