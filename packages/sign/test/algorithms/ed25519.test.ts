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
import { Effect } from "effect"
import { ed25519Keygen, ed25519Sign, ed25519Verify } from "../../src/algorithms/ed25519.js"

describe("Ed25519 — algorithm contracts", () => {
  const message = new TextEncoder().encode("hello noble")

  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      const valid = yield* ed25519Verify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("produces 64-byte signatures", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(64)
    }))

  it.effect("deterministic signing — identical inputs produce identical signatures", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig1 = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      const sig2 = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      expect(sig1.signature).toEqual(sig2.signature)
    }))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      const tampered = new Uint8Array(sig.signature)
      tampered[0] = tampered[0]! ^ 0xff
      const valid = yield* ed25519Verify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* ed25519Keygen()
      const kp2 = yield* ed25519Keygen()
      const sig = yield* ed25519Sign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* ed25519Verify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("signs and verifies empty message", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const empty = new Uint8Array(0)
      const sig = yield* ed25519Sign(empty, kp.secretKey, kp.publicKey)
      const valid = yield* ed25519Verify(sig.signature, empty, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("generates 32-byte keys", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("ed25519")
    }))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* ed25519Keygen()
      const kp2 = yield* ed25519Keygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))

  it.effect("Signature carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* ed25519Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ed25519")
    }))
})
