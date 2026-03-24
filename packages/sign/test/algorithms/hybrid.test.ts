/**
 * Hybrid classical + post-quantum algorithm contract tests.
 *
 * Verifies:
 * - XWing key agreement roundtrip (encapsulate → decapsulate)
 * - Shared secret symmetry for XWing
 * - 32-byte combined shared secret output
 * - Different key pairs produce different shared secrets
 * - Encapsulated ciphertext is well-formed
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { xwingDecapsulate, xwingEncapsulate, xwingKeygen } from "../../src/algorithms/hybrid.js"

describe("XWing — KEM algorithm contracts", () => {
  it.effect("encapsulate → decapsulate roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* xwingEncapsulate(kp.publicKey)
      const sharedSecret = yield* xwingDecapsulate(encap.ciphertext, kp.secretKey)
      expect(sharedSecret).toEqual(encap.sharedSecret)
    }))

  it.effect("shared secret is 32 bytes", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* xwingEncapsulate(kp.publicKey)
      expect(encap.sharedSecret.length).toBe(32)
    }))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const kp1 = yield* xwingKeygen()
      const kp2 = yield* xwingKeygen()
      const encap1 = yield* xwingEncapsulate(kp1.publicKey)
      const encap2 = yield* xwingEncapsulate(kp2.publicKey)
      expect(encap1.sharedSecret).not.toEqual(encap2.sharedSecret)
    }))

  it.effect("KemCiphertext carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* xwingEncapsulate(kp.publicKey)
      expect(encap.algorithm).toBe("xwing")
    }))

  it.effect("ciphertext is non-empty", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* xwingEncapsulate(kp.publicKey)
      expect(encap.ciphertext.length).toBeGreaterThan(0)
    }))

  it.effect("KeyPair carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      expect(kp.algorithm).toBe("xwing")
    }))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* xwingKeygen()
      const kp2 = yield* xwingKeygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))
})
