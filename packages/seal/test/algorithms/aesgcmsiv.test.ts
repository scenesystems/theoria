/**
 * AES-256-GCM-SIV algorithm contract tests.
 *
 * Verifies:
 * - Encrypt/decrypt round-trip produces identical plaintext
 * - Different nonces produce different ciphertext for same plaintext
 * - Tampered ciphertext is rejected (authentication failure)
 * - Wrong key is rejected
 * - 32-byte key requirement is enforced
 * - Output contains 12-byte prepended nonce
 * - Empty plaintext is handled correctly
 * - Large plaintext (64KB) encrypts and decrypts correctly
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { aesgcmsivDecrypt, aesgcmsivEncrypt } from "../../src/algorithms/aesgcmsiv.js"
import { DecryptionFailed, InvalidKey } from "../../src/schemas/errors.js"
import { longKey, plaintext, shortKey, validKey, wrongKey } from "../helpers/keys.js"

describe("aesgcmsivEncrypt / aesgcmsivDecrypt", () => {
  it.effect("round-trip identity — decrypt recovers original plaintext", () =>
    Effect.gen(function*() {
      const encrypted = yield* aesgcmsivEncrypt(validKey, plaintext)
      const decrypted = yield* aesgcmsivDecrypt(validKey, encrypted)
      expect(decrypted).toEqual(plaintext)
    }))

  it.effect("nonce uniqueness — two encryptions of same plaintext differ", () =>
    Effect.gen(function*() {
      const a = yield* aesgcmsivEncrypt(validKey, plaintext)
      const b = yield* aesgcmsivEncrypt(validKey, plaintext)
      expect(a).not.toEqual(b)
    }))

  it.effect("wrong key is rejected with DecryptionFailed", () =>
    Effect.gen(function*() {
      const encrypted = yield* aesgcmsivEncrypt(validKey, plaintext)
      const exit = yield* Effect.exit(aesgcmsivDecrypt(wrongKey, encrypted))
      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "aes-256-gcm-siv",
            reason: "authentication failed"
          })
        )
      )
    }))

  it.effect("tampered ciphertext is rejected with DecryptionFailed", () =>
    Effect.gen(function*() {
      const encrypted = yield* aesgcmsivEncrypt(validKey, plaintext)
      const tampered = Uint8Array.from(encrypted)
      tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff
      const exit = yield* Effect.exit(aesgcmsivDecrypt(validKey, tampered))
      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "aes-256-gcm-siv",
            reason: "authentication failed"
          })
        )
      )
    }))

  it.effect("rejects 16-byte key with InvalidKey", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(aesgcmsivEncrypt(shortKey, plaintext))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 16, reason: "key must be exactly 32 bytes, got 16" }))
      )
    }))

  it.effect("rejects 64-byte key with InvalidKey", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(aesgcmsivEncrypt(longKey, plaintext))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 64, reason: "key must be exactly 32 bytes, got 64" }))
      )
    }))

  it.effect("decrypt rejects short key with InvalidKey", () =>
    Effect.gen(function*() {
      const encrypted = yield* aesgcmsivEncrypt(validKey, plaintext)
      const exit = yield* Effect.exit(aesgcmsivDecrypt(shortKey, encrypted))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 16, reason: "key must be exactly 32 bytes, got 16" }))
      )
    }))

  it.effect("empty plaintext round-trip", () =>
    Effect.gen(function*() {
      const empty = new Uint8Array(0)
      const encrypted = yield* aesgcmsivEncrypt(validKey, empty)
      const decrypted = yield* aesgcmsivDecrypt(validKey, encrypted)
      expect(decrypted).toEqual(empty)
    }))

  it.effect("large plaintext round-trip (64KB)", () =>
    Effect.gen(function*() {
      const large = new Uint8Array(65536).fill(0x42)
      const encrypted = yield* aesgcmsivEncrypt(validKey, large)
      const decrypted = yield* aesgcmsivDecrypt(validKey, encrypted)
      expect(decrypted).toEqual(large)
    }))

  it.effect("output contains 12-byte prepended nonce", () =>
    Effect.gen(function*() {
      const encrypted = yield* aesgcmsivEncrypt(validKey, plaintext)
      expect(encrypted.length).toBe(12 + plaintext.length + 16)
    }))
})
