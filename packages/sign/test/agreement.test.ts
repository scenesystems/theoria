/**
 * Key agreement pipeline contract tests.
 *
 * Verifies:
 * - deriveSharedSecret("x25519", ...) produces 32-byte shared secret
 * - Shared secret symmetry (A→B == B→A)
 * - Different key pairs produce different shared secrets
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { deriveSharedSecret } from "../src/agreement.js"
import { x25519Keygen } from "../src/algorithms/x25519.js"

describe("Key agreement pipeline", () => {
  it.effect("deriveSharedSecret('x25519') produces 32-byte shared secret", () =>
    Effect.gen(function*() {
      const kpA = yield* x25519Keygen()
      const kpB = yield* x25519Keygen()
      const secret = yield* deriveSharedSecret("x25519", kpA.secretKey, kpB.publicKey)
      expect(secret.algorithm).toBe("x25519")
      expect(secret.sharedSecret.length).toBe(32)
    }))

  it.effect("shared secret symmetry — A→B == B→A", () =>
    Effect.gen(function*() {
      const kpA = yield* x25519Keygen()
      const kpB = yield* x25519Keygen()
      const secretAB = yield* deriveSharedSecret("x25519", kpA.secretKey, kpB.publicKey)
      const secretBA = yield* deriveSharedSecret("x25519", kpB.secretKey, kpA.publicKey)
      expect(secretAB.sharedSecret).toEqual(secretBA.sharedSecret)
    }))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const kpA = yield* x25519Keygen()
      const kpB = yield* x25519Keygen()
      const kpC = yield* x25519Keygen()
      const secretAB = yield* deriveSharedSecret("x25519", kpA.secretKey, kpB.publicKey)
      const secretAC = yield* deriveSharedSecret("x25519", kpA.secretKey, kpC.publicKey)
      expect(secretAB.sharedSecret).not.toEqual(secretAC.sharedSecret)
    }))
})
