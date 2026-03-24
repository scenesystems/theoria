/**
 * X25519 ECDH key agreement contract tests.
 *
 * Verifies:
 * - Shared secret symmetry (A→B == B→A)
 * - 32-byte shared secret output shape
 * - Different key pairs produce different shared secrets
 * - Key pair generation produces valid 32-byte keys
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { x25519Keygen, x25519SharedSecret } from "../../src/algorithms/x25519.js"

describe("X25519 ECDH — algorithm contracts", () => {
  it.effect("shared secret symmetry (A→B == B→A)", () =>
    Effect.gen(function*() {
      const alice = yield* x25519Keygen()
      const bob = yield* x25519Keygen()
      const ssAB = yield* x25519SharedSecret(alice.secretKey, bob.publicKey)
      const ssBA = yield* x25519SharedSecret(bob.secretKey, alice.publicKey)
      expect(ssAB.sharedSecret).toEqual(ssBA.sharedSecret)
    }))

  it.effect("produces 32-byte shared secret", () =>
    Effect.gen(function*() {
      const alice = yield* x25519Keygen()
      const bob = yield* x25519Keygen()
      const ss = yield* x25519SharedSecret(alice.secretKey, bob.publicKey)
      expect(ss.sharedSecret.length).toBe(32)
      expect(ss.algorithm).toBe("x25519")
    }))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const alice = yield* x25519Keygen()
      const bob = yield* x25519Keygen()
      const carol = yield* x25519Keygen()
      const ssAB = yield* x25519SharedSecret(alice.secretKey, bob.publicKey)
      const ssAC = yield* x25519SharedSecret(alice.secretKey, carol.publicKey)
      expect(ssAB.sharedSecret).not.toEqual(ssAC.sharedSecret)
    }))

  it.effect("generates 32-byte keys", () =>
    Effect.gen(function*() {
      const kp = yield* x25519Keygen()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("x25519")
    }))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* x25519Keygen()
      const kp2 = yield* x25519Keygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))
})
