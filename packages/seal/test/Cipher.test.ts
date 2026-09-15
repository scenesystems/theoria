import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Effect, Exit, FastCheck } from "effect"
import { key, plaintext } from "./fixtures/vectors.js"

describe.each(Cipher.Algorithm.literals)("Cipher %s", (algorithm) => {
  it.effect.prop("recovers arbitrary bytes without modifying inputs", {
    message: FastCheck.uint8Array({ maxLength: 1024 }),
    secret: FastCheck.uint8Array({ minLength: 32, maxLength: 32 }).filter((bytes) => bytes.some((byte) => byte !== 0))
  }, ({ message, secret }) =>
    Effect.gen(function*() {
      const originalKey = secret.slice()
      const originalMessage = message.slice()
      const encrypted = yield* Cipher.encrypt(algorithm, secret, message)
      const originalEncrypted = encrypted.slice()
      const recovered = yield* Cipher.decrypt(algorithm, secret, encrypted)
      expect(recovered).toEqual(originalMessage)
      expect(secret).toEqual(originalKey)
      expect(message).toEqual(originalMessage)
      expect(encrypted).toEqual(originalEncrypted)
      expect(recovered.buffer).not.toBe(encrypted.buffer)
    }).pipe(Effect.provide(Cipher.layer)), { fastCheck: { seed: 20260915, numRuns: 40 } })

  it.effect("supports empty and large messages and generates a nonce on every execution", () =>
    Effect.forEach(
      [new Uint8Array(), Uint8Array.from({ length: 65536 }, (_, i) => i % 251)],
      (message) =>
        Effect.gen(function*() {
          const operation = Cipher.encrypt(algorithm, key, message)
          const first = yield* operation
          const second = yield* operation
          expect(first).not.toEqual(second)
          expect(yield* Cipher.decrypt(algorithm, key, first)).toEqual(message)
        })
    ).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects wrong keys and changes to the nonce, ciphertext, or tag identically", () =>
    Effect.gen(function*() {
      const encrypted = yield* Cipher.encrypt(algorithm, key, plaintext)
      const failure = Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
      expect(yield* Effect.exit(Cipher.decrypt(algorithm, new Uint8Array(32).fill(81), encrypted))).toStrictEqual(
        failure
      )
      yield* Effect.forEach([0, encrypted.length - 17, encrypted.length - 1], (index) =>
        Effect.gen(function*() {
          const tampered = encrypted.slice()
          tampered[index] = (tampered[index] ?? 0) ^ 1
          expect(yield* Effect.exit(Cipher.decrypt(algorithm, key, tampered))).toStrictEqual(failure)
        }))
      yield* Effect.forEach([0, 11, 12, 23, 24, encrypted.length - 1], (length) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Cipher.decrypt(algorithm, key, encrypted.subarray(0, length))))
            .toStrictEqual(failure)
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("validates both sides of the key-length boundary for encryption and decryption", () =>
    Effect.gen(function*() {
      yield* Effect.forEach([0, 16, 31, 33, 64], (length) =>
        Effect.gen(function*() {
          const invalid = new Uint8Array(length).fill(17)
          const failure = Exit.fail(
            new Cipher.InvalidKey({
              expected: 32,
              received: length,
              reason: `key must be exactly 32 bytes, got ${length}`
            })
          )
          expect(yield* Effect.exit(Cipher.encrypt(algorithm, invalid, plaintext))).toStrictEqual(failure)
          expect(yield* Effect.exit(Cipher.decrypt(algorithm, invalid, new Uint8Array()))).toStrictEqual(failure)
        }))
      const zero = new Uint8Array(32)
      const failure = Exit.fail(
        new Cipher.InvalidKey({
          expected: 32,
          received: 32,
          reason: "key is all-zero (weak key rejected)"
        })
      )
      expect(yield* Effect.exit(Cipher.encrypt(algorithm, zero, plaintext))).toStrictEqual(failure)
      expect(yield* Effect.exit(Cipher.decrypt(algorithm, zero, new Uint8Array()))).toStrictEqual(failure)
    }).pipe(Effect.provide(Cipher.layer)))
})

it.effect("generates fresh usable 32-byte keys on each execution", () =>
  Effect.gen(function*() {
    const first = yield* Cipher.generateKey
    const second = yield* Cipher.generateKey
    expect(first.length).toBe(32)
    expect(second.length).toBe(32)
    expect(first).not.toEqual(second)
    yield* Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
      Effect.gen(function*() {
        const encrypted = yield* Cipher.encrypt(algorithm, first, plaintext)
        expect(yield* Cipher.decrypt(algorithm, first, encrypted)).toEqual(plaintext)
      }))
  }).pipe(Effect.provide(Cipher.layer)))
