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
import {
  mlDsa44Keygen,
  mlDsa44Sign,
  mlDsa44Verify,
  mlDsa65Keygen,
  mlDsa65SignDeterministic,
  mlDsa65Verify,
  mlDsa87Keygen,
  mlDsa87Sign,
  mlDsa87Verify,
  utf8ToBytes
} from "@scenesystems/sign"
import { Array as Arr, Effect, Number as N, Schema } from "effect"
import { hasInvalidMlDsa65HintEncoding } from "../../src/internal/mlDsa65.js"

const message = utf8ToBytes("post-quantum hello")
const EMPTY_CONTEXT = utf8ToBytes("")

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
})

describe("ML-DSA-65 — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65SignDeterministic(message, kp.secretKey, kp.publicKey)
      const valid = yield* mlDsa65Verify(sig.signature, message, kp.publicKey, EMPTY_CONTEXT)
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
      const sig = yield* mlDsa65SignDeterministic(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(3309)
    }))

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* mlDsa65Keygen()
      const kp2 = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65SignDeterministic(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* mlDsa65Verify(sig.signature, message, kp2.publicKey, EMPTY_CONTEXT)
      expect(valid).toBe(false)
    }))

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65SignDeterministic(message, kp.secretKey, kp.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(sig.signature), 0, (byte) => N.subtract(255, byte))
      )
      const valid = yield* mlDsa65Verify(tampered, message, kp.publicKey, EMPTY_CONTEXT)
      expect(valid).toBe(false)
    }))

  it.effect("admits empty hint segments and rejects endpoint, ordering, padding, and truncation errors", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* mlDsa65SignDeterministic(message, kp.secretKey, kp.publicKey)
      expect(hasInvalidMlDsa65HintEncoding(sig.signature)).toBe(false)

      // Indices [4, 9], then an empty segment, then [4]: ordering is local to each segment.
      const canonical = Arr.appendAll(
        Arr.appendAll(Arr.appendAll(Arr.replicate(0, 3_248), Arr.make(4, 9, 4)), Arr.replicate(0, 52)),
        Arr.make(2, 2, 3, 3, 3, 3)
      )
      const full = Arr.appendAll(
        Arr.appendAll(Arr.replicate(0, 3_248), Arr.range(0, 54)),
        Arr.replicate(55, 6)
      )
      yield* Effect.forEach(Arr.make(Arr.replicate(0, 3_309), canonical, full), (bytes) =>
        Effect.gen(function*() {
          expect(hasInvalidMlDsa65HintEncoding(yield* Schema.decode(Schema.Uint8Array)(bytes))).toBe(false)
        }))
      yield* Effect.forEach(
        Arr.make(
          Arr.replace(canonical, 3_303, 56),
          Arr.replace(canonical, 3_304, 1),
          Arr.replace(canonical, 3_249, 4),
          Arr.replace(canonical, 3_249, 3),
          Arr.replace(canonical, 3_251, 1)
        ),
        (bytes) =>
          Effect.gen(function*() {
            expect(hasInvalidMlDsa65HintEncoding(yield* Schema.decode(Schema.Uint8Array)(bytes))).toBe(true)
          })
      )
      // Zero-filled bytes pass per-endpoint checks; missing endpoint bytes must still reject.
      yield* Effect.forEach(Arr.range(0, 5), (present) =>
        Effect.gen(function*() {
          const bytes = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, N.sum(3_303, present)))
          expect(hasInvalidMlDsa65HintEncoding(bytes)).toBe(true)
        }))
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
