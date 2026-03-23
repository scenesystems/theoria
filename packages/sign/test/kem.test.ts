/**
 * Key encapsulation mechanism pipeline contract tests.
 *
 * Verifies:
 * - encapsulate("xwing", publicKey) produces ciphertext + shared secret
 * - decapsulate("xwing", ciphertext, secretKey) recovers same shared secret
 * - Encapsulation roundtrip: encapsulate → decapsulate → identical shared secret
 * - Different key pairs produce different shared secrets
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { xwingKeygen } from "../src/algorithms/hybrid.js"
import { decapsulate, encapsulate } from "../src/kem.js"

describe("KEM pipeline", () => {
  it.effect("encapsulate → decapsulate roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* encapsulate("xwing", kp.publicKey)
      expect(encap.algorithm).toBe("xwing")
      expect(encap.sharedSecret.length).toBe(32)
      const sharedSecret = yield* decapsulate("xwing", encap.ciphertext, kp.secretKey)
      expect(sharedSecret).toEqual(encap.sharedSecret)
    }))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const kp1 = yield* xwingKeygen()
      const kp2 = yield* xwingKeygen()
      const encap1 = yield* encapsulate("xwing", kp1.publicKey)
      const encap2 = yield* encapsulate("xwing", kp2.publicKey)
      expect(encap1.sharedSecret).not.toEqual(encap2.sharedSecret)
    }))

  it.effect("ciphertext is non-empty", () =>
    Effect.gen(function*() {
      const kp = yield* xwingKeygen()
      const encap = yield* encapsulate("xwing", kp.publicKey)
      expect(encap.ciphertext.length).toBeGreaterThan(0)
    }))
})
