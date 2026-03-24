/**
 * Key generation and key pair management contract tests.
 *
 * Verifies:
 * - generateKeyPair("ed25519") produces 32B keys
 * - generateKeyPair("ml-dsa-65") produces correct-size PQ keys
 * - generateKeyPair("x25519") produces 32B agreement keys
 * - generateKeyPair("xwing") produces correct-size KEM keys
 * - Each call produces unique key pairs (CSPRNG)
 * - Key pair carries correct algorithm discriminant
 * - Key sizes match algorithm specifications
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { generateKeyPair } from "../src/keyPair.js"

describe("generateKeyPair — unified key generation", () => {
  it.effect("ed25519 → 32B keys", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("ed25519")
      expect(kp.algorithm).toBe("ed25519")
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(32)
    }))

  it.effect("secp256k1-ecdsa → valid key pair", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("secp256k1-ecdsa")
      expect(kp.algorithm).toBe("secp256k1-ecdsa")
      expect(kp.publicKey.length).toBeGreaterThan(0)
      expect(kp.secretKey.length).toBeGreaterThan(0)
    }))

  it.effect("x25519 → 32B agreement keys", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("x25519")
      expect(kp.algorithm).toBe("x25519")
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(32)
    }))

  it.effect("ml-dsa-65 → correct PQ key sizes", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("ml-dsa-65")
      expect(kp.algorithm).toBe("ml-dsa-65")
      expect(kp.publicKey.length).toBe(1952)
      expect(kp.secretKey.length).toBe(4032)
    }))

  it.effect("xwing → valid KEM key pair", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("xwing")
      expect(kp.algorithm).toBe("xwing")
      expect(kp.publicKey.length).toBeGreaterThan(0)
      expect(kp.secretKey.length).toBeGreaterThan(0)
    }))

  it.effect("each call produces unique key pairs", () =>
    Effect.gen(function*() {
      const kp1 = yield* generateKeyPair("ed25519")
      const kp2 = yield* generateKeyPair("ed25519")
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))

  it.effect("ml-dsa-44 → correct PQ key sizes", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("ml-dsa-44")
      expect(kp.algorithm).toBe("ml-dsa-44")
      expect(kp.publicKey.length).toBe(1312)
      expect(kp.secretKey.length).toBe(2560)
    }))

  it.effect("slh-dsa-sha2-128f → 32B pk, 64B sk", () =>
    Effect.gen(function*() {
      const kp = yield* generateKeyPair("slh-dsa-sha2-128f")
      expect(kp.algorithm).toBe("slh-dsa-sha2-128f")
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(64)
    }))
})
