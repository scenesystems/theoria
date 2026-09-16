import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Array, Effect, Exit, FastCheck, Number, Schema } from "effect"
import { key, plaintext } from "./fixtures/vectors.js"

describe.each(Cipher.Algorithm.literals)("Cipher %s", (algorithm) => {
  it.effect.prop("recovers arbitrary bytes without modifying inputs", {
    message: FastCheck.uint8Array({ maxLength: 1024 }),
    secret: FastCheck.uint8Array({ minLength: 32, maxLength: 32 }).filter((bytes) =>
      Number.greaterThan(Number.sumAll(bytes), 0)
    )
  }, ({ message, secret }) =>
    Effect.gen(function*() {
      const originalKey = Array.fromIterable(secret)
      const originalMessage = Array.fromIterable(message)
      const encrypted = yield* Cipher.encrypt(algorithm, secret, message)
      const originalEncrypted = Array.fromIterable(encrypted)
      const recovered = yield* Cipher.decrypt(algorithm, secret, encrypted)
      expect(Array.fromIterable(recovered)).toEqual(originalMessage)
      expect(Array.fromIterable(secret)).toEqual(originalKey)
      expect(Array.fromIterable(message)).toEqual(originalMessage)
      expect(Array.fromIterable(encrypted)).toEqual(originalEncrypted)
      expect(recovered.buffer).not.toBe(encrypted.buffer)
    }).pipe(Effect.provide(Cipher.layer)), { fastCheck: { seed: 20260915, numRuns: 40 } })

  it.effect("supports empty and large messages and generates a nonce on every execution", () =>
    Effect.forEach(
      [Array.empty<number>(), Array.makeBy(65536, Number.remainder(251))],
      (bytes) =>
        Effect.gen(function*() {
          const message = yield* Schema.decode(Schema.Uint8Array)(bytes)
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
      const wrongKey = yield* Schema.decode(Schema.Uint8Array)(Array.replicate(81, 32))
      expect(yield* Effect.exit(Cipher.decrypt(algorithm, wrongKey, encrypted))).toStrictEqual(
        failure
      )
      yield* Effect.forEach(
        [0, Number.subtract(encrypted.length, 17), Number.decrement(encrypted.length)],
        (index) =>
          Effect.gen(function*() {
            const tampered = yield* Schema.decode(Schema.Uint8Array)(
              Array.modify(encrypted, index, (byte) => Number.remainder(Number.increment(byte), 256))
            )
            expect(yield* Effect.exit(Cipher.decrypt(algorithm, key, tampered))).toStrictEqual(failure)
          })
      )
      yield* Effect.forEach(
        [0, 11, 12, 23, 24, Number.decrement(encrypted.length)],
        (length) =>
          Effect.gen(function*() {
            const truncated = yield* Schema.decode(Schema.Uint8Array)(Array.take(encrypted, length))
            expect(yield* Effect.exit(Cipher.decrypt(algorithm, key, truncated)))
              .toStrictEqual(failure)
          })
      )
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("validates both sides of the key-length boundary for encryption and decryption", () =>
    Effect.gen(function*() {
      yield* Effect.forEach([0, 16, 31, 33, 64], (length) =>
        Effect.gen(function*() {
          const invalid = yield* Schema.decode(Schema.Uint8Array)(Array.take(Array.replicate(17, 64), length))
          const failure = Exit.fail(
            new Cipher.InvalidKey({
              expected: 32,
              received: length,
              reason: `key must be exactly 32 bytes, got ${length}`
            })
          )
          expect(yield* Effect.exit(Cipher.encrypt(algorithm, invalid, plaintext))).toStrictEqual(failure)
          expect(yield* Effect.exit(Cipher.decrypt(algorithm, invalid, plaintext))).toStrictEqual(failure)
        }))
      const zero = yield* Schema.decode(Schema.Uint8Array)(Array.replicate(0, 32))
      const failure = Exit.fail(
        new Cipher.InvalidKey({
          expected: 32,
          received: 32,
          reason: "key is all-zero (weak key rejected)"
        })
      )
      expect(yield* Effect.exit(Cipher.encrypt(algorithm, zero, plaintext))).toStrictEqual(failure)
      expect(yield* Effect.exit(Cipher.decrypt(algorithm, zero, plaintext))).toStrictEqual(failure)
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("accepts a key with its only nonzero byte at either boundary", () =>
    Effect.forEach([0, 31], (index) =>
      Effect.gen(function*() {
        const sparse = yield* Schema.decode(Schema.Uint8Array)(Array.replace(Array.replicate(0, 32), index, 255))
        const encrypted = yield* Cipher.encrypt(algorithm, sparse, plaintext)
        expect(yield* Cipher.decrypt(algorithm, sparse, encrypted)).toEqual(plaintext)
      })).pipe(Effect.provide(Cipher.layer)))
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
