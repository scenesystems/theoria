/**
 * SLH-DSA (SPHINCS+, FIPS-205) contract tests.
 *
 * Verifies:
 * - SLH-DSA-SHA2-128f sign → verify roundtrip
 * - SLH-DSA-SHA2-128s sign → verify roundtrip (smaller signatures)
 * - Expected key sizes (32B pk, 64B sk for 128-bit level)
 * - Expected signature sizes (17088B for 128f, 7856B for 128s)
 * - Invalid signature rejection
 * - Wrong public key rejection
 *
 * SLH-DSA signing is SLOW (~1-5s). All tests use 30s timeouts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import {
  slhDsaSha2128fKeygen,
  slhDsaSha2128fSign,
  slhDsaSha2128fVerify,
  slhDsaSha2128sKeygen,
  slhDsaSha2128sSign,
  slhDsaSha2128sVerify
} from "../../src/algorithms/slhDsa.js"

const message = new TextEncoder().encode("hash-based hello")

describe("SLH-DSA-SHA2-128f — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128fKeygen()
      const sig = yield* slhDsaSha2128fSign(message, kp.secretKey, kp.publicKey)
      const valid = yield* slhDsaSha2128fVerify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }), { timeout: 30_000 })

  it.effect("expected key sizes — 32B pk, 64B sk", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128fKeygen()
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(64)
      expect(kp.algorithm).toBe("slh-dsa-sha2-128f")
    }))

  it.effect("expected signature size — 17088B", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128fKeygen()
      const sig = yield* slhDsaSha2128fSign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(17088)
    }), { timeout: 30_000 })

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* slhDsaSha2128fKeygen()
      const kp2 = yield* slhDsaSha2128fKeygen()
      const sig = yield* slhDsaSha2128fSign(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* slhDsaSha2128fVerify(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }), { timeout: 30_000 })

  it.effect("Signature carries correct algorithm tag", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128fKeygen()
      const sig = yield* slhDsaSha2128fSign(message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("slh-dsa-sha2-128f")
    }), { timeout: 30_000 })
})

describe("SLH-DSA-SHA2-128s — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128sKeygen()
      const sig = yield* slhDsaSha2128sSign(message, kp.secretKey, kp.publicKey)
      const valid = yield* slhDsaSha2128sVerify(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }), { timeout: 30_000 })

  it.effect("expected key sizes — 32B pk, 64B sk", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128sKeygen()
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(64)
      expect(kp.algorithm).toBe("slh-dsa-sha2-128s")
    }))

  it.effect("expected signature size — 7856B", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128sKeygen()
      const sig = yield* slhDsaSha2128sSign(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(7856)
    }), { timeout: 30_000 })

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128sKeygen()
      const sig = yield* slhDsaSha2128sSign(message, kp.secretKey, kp.publicKey)
      const tampered = new Uint8Array(sig.signature)
      tampered[0] = tampered[0]! ^ 0xff
      const valid = yield* slhDsaSha2128sVerify(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }), { timeout: 30_000 })

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* slhDsaSha2128sKeygen()
      const kp2 = yield* slhDsaSha2128sKeygen()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }))
})
