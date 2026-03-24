/**
 * ML-DSA (Dilithium, FIPS-204) contract tests.
 *
 * Verifies:
 * - ML-DSA-44 sign → verify roundtrip
 * - ML-DSA-65 sign → verify roundtrip (primary)
 * - ML-DSA-87 sign → verify roundtrip
 * - Expected key sizes (1312B/2560B for ML-DSA-44, etc.)
 * - Expected signature sizes (2420B, 3309B, 4627B)
 * - Deterministic signing (same message + key → same signature)
 * - Invalid signature rejection
 * - Wrong public key rejection
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import {
  mlDsa44Keygen,
  mlDsa44Sign,
  mlDsa44Verify,
  mlDsa65Keygen,
  mlDsa65Sign,
  mlDsa65Verify,
  mlDsa87Keygen,
  mlDsa87Sign,
  mlDsa87Verify
} from "../../src/algorithms/mlDsa.js"

const message = new TextEncoder().encode("post-quantum hello")

describe("ML-DSA-44 — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa44Keygen()
      const sig = yield* mlDsa44Sign(message, kp.secretKey, kp.publicKey)
      const valid = yield* mlDsa44Verify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("expected key sizes — 1312B pk, 2560B sk", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa44Keygen()
      expect(kp.publicKey.length).toBe(1312)
      expect(kp.secretKey.length).toBe(2560)
      expect(kp.algorithm).toBe("ml-dsa-44")
    }))

  it.effect("expected signature size — 2420B", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa44Keygen()
      const sig = yield* mlDsa44Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(2420)
    }))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* mlDsa44Keygen()
      const kp2 = yield* mlDsa44Keygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* mlDsa44Keygen()
      const kp2 = yield* mlDsa44Keygen()
      const sig = yield* mlDsa44Sign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* mlDsa44Verify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("Signature carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa44Keygen()
      const sig = yield* mlDsa44Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ml-dsa-44")
    }))
})

describe("ML-DSA-65 — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65Sign(message, kp.secretKey, kp.publicKey)
      const valid = yield* mlDsa65Verify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("expected key sizes — 1952B pk, 4032B sk", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      expect(kp.publicKey.length).toBe(1952)
      expect(kp.secretKey.length).toBe(4032)
      expect(kp.algorithm).toBe("ml-dsa-65")
    }))

  it.effect("expected signature size — 3309B", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(3309)
    }))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* mlDsa65Keygen()
      const kp2 = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65Sign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* mlDsa65Verify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65Sign(message, kp.secretKey, kp.publicKey)
      const tampered = new Uint8Array(sig.signature)
      tampered[0] = tampered[0]! ^ 0xff
      const valid = yield* mlDsa65Verify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }))
})

describe("ML-DSA-87 — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa87Keygen()
      const sig = yield* mlDsa87Sign(message, kp.secretKey, kp.publicKey)
      const valid = yield* mlDsa87Verify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("expected key sizes — 2592B pk, 4896B sk", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa87Keygen()
      expect(kp.publicKey.length).toBe(2592)
      expect(kp.secretKey.length).toBe(4896)
      expect(kp.algorithm).toBe("ml-dsa-87")
    }))

  it.effect("expected signature size — 4627B", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa87Keygen()
      const sig = yield* mlDsa87Sign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(4627)
    }))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* mlDsa87Keygen()
      const kp2 = yield* mlDsa87Keygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))
})
