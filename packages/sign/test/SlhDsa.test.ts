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
import { Bytes, Entropy, SlhDsa } from "@scenesystems/sign"
import { Array as Arr, Effect, Number as N, Schema } from "effect"

const message = Bytes.fromString("hash-based hello")

describe("SLH-DSA-SHA2-128f — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128fKeyPair()
      const sig = yield* SlhDsa.signSha2128f(message, kp.secretKey, kp.publicKey)
      const valid = yield* SlhDsa.verifySha2128f(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })

  it.effect("expected key sizes — 32B pk, 64B sk", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128fKeyPair()
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(64)
      expect(kp.algorithm).toBe("slh-dsa-sha2-128f")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("expected signature size — 17088B", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128fKeyPair()
      const sig = yield* SlhDsa.signSha2128f(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(17088)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })

  it.effect("rejects wrong public key", () =>
    Effect.gen(function*() {
      const kp1 = yield* SlhDsa.generateSha2128fKeyPair()
      const kp2 = yield* SlhDsa.generateSha2128fKeyPair()
      const sig = yield* SlhDsa.signSha2128f(message, kp1.secretKey, kp1.publicKey)
      const valid = yield* SlhDsa.verifySha2128f(sig.signature, message, kp2.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })
})

describe("SLH-DSA-SHA2-128s — algorithm contracts", () => {
  it.effect("sign → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128sKeyPair()
      const sig = yield* SlhDsa.signSha2128s(message, kp.secretKey, kp.publicKey)
      const valid = yield* SlhDsa.verifySha2128s(sig.signature, message, kp.publicKey)
      expect(valid).toBe(true)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })

  it.effect("expected key sizes — 32B pk, 64B sk", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128sKeyPair()
      expect(kp.publicKey.length).toBe(32)
      expect(kp.secretKey.length).toBe(64)
      expect(kp.algorithm).toBe("slh-dsa-sha2-128s")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("expected signature size — 7856B", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128sKeyPair()
      const sig = yield* SlhDsa.signSha2128s(message, kp.secretKey, kp.publicKey)
      expect(sig.signature.length).toBe(7856)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })

  it.effect("rejects tampered signature", () =>
    Effect.gen(function*() {
      const kp = yield* SlhDsa.generateSha2128sKeyPair()
      const sig = yield* SlhDsa.signSha2128s(message, kp.secretKey, kp.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(sig.signature), 0, (byte) => N.subtract(255, byte))
      )
      const valid = yield* SlhDsa.verifySha2128s(tampered, message, kp.publicKey)
      expect(valid).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 30_000 })

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* SlhDsa.generateSha2128sKeyPair()
      const kp2 = yield* SlhDsa.generateSha2128sKeyPair()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})

describe("higher-security SLH-DSA suites", () => {
  it.effect("signs and verifies SHA2-192f", () =>
    Effect.gen(function*() {
      const keys = yield* SlhDsa.generateSha2192fKeyPair()
      const signed = yield* SlhDsa.signSha2192f(message, keys.secretKey, keys.publicKey)
      expect(yield* SlhDsa.verifySha2192f(signed.signature, message, keys.publicKey)).toBe(true)
      expect(keys.publicKey.length).toBe(48)
      expect(keys.secretKey.length).toBe(96)
      expect(signed.signature.length).toBe(35_664)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 60_000 })

  it.effect("signs and verifies SHA2-256f", () =>
    Effect.gen(function*() {
      const keys = yield* SlhDsa.generateSha2256fKeyPair()
      const signed = yield* SlhDsa.signSha2256f(message, keys.secretKey, keys.publicKey)
      expect(yield* SlhDsa.verifySha2256f(signed.signature, message, keys.publicKey)).toBe(true)
      expect(keys.publicKey.length).toBe(64)
      expect(keys.secretKey.length).toBe(128)
      expect(signed.signature.length).toBe(49_856)
    }).pipe(Effect.provide(Entropy.layer)), { timeout: 60_000 })
})
