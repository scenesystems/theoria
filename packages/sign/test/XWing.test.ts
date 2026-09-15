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
import { Entropy, XWing } from "@scenesystems/sign"
import { Effect } from "effect"

describe("XWing — KEM algorithm contracts", () => {
  it.effect("encapsulate → decapsulate roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      const sharedSecret = yield* XWing.decapsulate(encap.ciphertext, kp.secretKey)
      expect(sharedSecret).toEqual(encap.sharedSecret)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("shared secret is 32 bytes", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      expect(encap.sharedSecret.length).toBe(32)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const kp1 = yield* XWing.generateKeyPair()
      const kp2 = yield* XWing.generateKeyPair()
      const encap1 = yield* XWing.encapsulate(kp1.publicKey)
      const encap2 = yield* XWing.encapsulate(kp2.publicKey)
      expect(encap1.sharedSecret).not.toEqual(encap2.sharedSecret)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("Encapsulation carries the correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      expect(encap.algorithm).toBe("xwing")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("ciphertext is non-empty", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      expect(encap.ciphertext.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("KeyPair carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      expect(kp.algorithm).toBe("xwing")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* XWing.generateKeyPair()
      const kp2 = yield* XWing.generateKeyPair()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})
