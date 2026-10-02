import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Array, Effect, Exit, Match, Schema, String } from "effect"
import { key as keyFixture, plaintext as plaintextFixture } from "./fixtures/vectors.js"

const bytes = Schema.decodeEffect(Schema.Uint8ArrayFromHex)
const messages = Schema.Uint8Array.check(Schema.isMaxLength(1024))
const flipByte = (value: string) => Match.value(value).pipe(Match.when("00", () => "ff"), Match.orElse(() => "00"))

describe.each(Cipher.Algorithm.literals)("Cipher %s", (algorithm) => {
  it.effect.prop(
    "recovers arbitrary bytes without modifying inputs",
    { plaintext: messages },
    ({ plaintext }) =>
      Effect.gen(function*() {
        const key = yield* bytes(keyFixture)
        const keyBefore = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(key)
        const plaintextBefore = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(plaintext)
        const encrypted = yield* Cipher.encrypt(algorithm, key, plaintext)
        const nonceBefore = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.nonce)
        const ciphertextBefore = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.ciphertext)
        const recovered = yield* Cipher.decrypt(encrypted, key)
        expect(recovered).toEqual(plaintext)
        expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(key)).toBe(keyBefore)
        expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(plaintext)).toBe(plaintextBefore)
        expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.nonce)).toBe(nonceBefore)
        expect(yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.ciphertext)).toBe(ciphertextBefore)
        expect(recovered).not.toBe(plaintext)
        expect(encrypted.nonce).not.toBe(plaintext)
        expect(encrypted.ciphertext).not.toBe(plaintext)
      }).pipe(Effect.provide(Cipher.layer)),
    { arbitrary: { seed: 20260915, runs: 40 } }
  )

  it.effect("supports empty and large messages and returns fresh output fields", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      yield* Effect.forEach(Array.make("", String.repeat(65536)("ab")), (fixture) =>
        Effect.gen(function*() {
          const plaintext = yield* bytes(fixture)
          const operation = Cipher.encrypt(algorithm, key, plaintext)
          const first = yield* operation
          const second = yield* operation
          expect(first).not.toBe(second)
          expect(first.nonce).not.toBe(second.nonce)
          expect(first.ciphertext).not.toBe(second.ciphertext)
          expect(first.nonce).not.toEqual(second.nonce)
          expect(yield* Cipher.decrypt(first, key)).toEqual(plaintext)
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects wrong keys and independent nonce, ciphertext, and tag corruption", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const plaintext = yield* bytes(plaintextFixture)
      const encrypted = yield* Cipher.encrypt(algorithm, key, plaintext)
      const nonceHex = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.nonce)
      const ciphertextHex = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(encrypted.ciphertext)
      const failure = (value: Cipher.Encrypted) => Effect.exit(Cipher.decrypt(value, key))
      const corrupt = (fixture: string, atEnd: boolean) =>
        bytes(
          Match.value(atEnd).pipe(
            Match.when(true, () => String.concat(String.slice(0, -2)(fixture), flipByte(String.takeRight(2)(fixture)))),
            Match.orElse(() => String.concat(flipByte(String.takeLeft(2)(fixture)), String.slice(2)(fixture)))
          )
        )
      const nonce = yield* corrupt(nonceHex, false)
      const ciphertext = yield* corrupt(ciphertextHex, false)
      const tag = yield* corrupt(ciphertextHex, true)
      const expected = Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
      expect(yield* failure(new Cipher.Encrypted({ algorithm, nonce, ciphertext: encrypted.ciphertext })))
        .toStrictEqual(expected)
      expect(yield* failure(new Cipher.Encrypted({ algorithm, nonce: encrypted.nonce, ciphertext }))).toStrictEqual(
        expected
      )
      expect(yield* failure(new Cipher.Encrypted({ algorithm, nonce: encrypted.nonce, ciphertext: tag })))
        .toStrictEqual(expected)
      const wrongKey = yield* bytes(String.repeat(32)("51"))
      expect(yield* Effect.exit(Cipher.decrypt(encrypted, wrongKey))).toStrictEqual(expected)
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("enforces nonce and tag lengths, including 12-byte GCM nonces", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const encrypted = yield* Cipher.encrypt(algorithm, key, yield* bytes(plaintextFixture))
      const expected = Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
      yield* Effect.forEach(Array.make(0, 11, 13, 23, 25), (length) =>
        Effect.gen(function*() {
          const nonce = yield* bytes(String.repeat(length)("00"))
          const invalid = new Cipher.Encrypted({ algorithm, nonce, ciphertext: encrypted.ciphertext })
          expect(yield* Effect.exit(Cipher.decrypt(invalid, key))).toStrictEqual(expected)
        }))
      yield* Effect.forEach(Array.make(0, 15), (length) =>
        Effect.gen(function*() {
          const ciphertext = yield* bytes(String.repeat(length)("00"))
          const invalid = new Cipher.Encrypted({ algorithm, nonce: encrypted.nonce, ciphertext })
          expect(yield* Effect.exit(Cipher.decrypt(invalid, key))).toStrictEqual(expected)
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("enforces key length and all-zero policy", () =>
    Effect.gen(function*() {
      const plaintext = yield* bytes(plaintextFixture)
      const encrypted = new Cipher.Encrypted({
        algorithm,
        nonce: yield* bytes(String.repeat(Cipher.nonceLength(algorithm))("00")),
        ciphertext: yield* bytes(String.repeat(16)("00"))
      })
      yield* Effect.forEach(Array.make(0, 16, 31, 33, 64), (length) =>
        Effect.gen(function*() {
          const invalid = yield* bytes(String.repeat(length)("11"))
          const expected = Exit.fail(
            new Cipher.InvalidKey({
              expected: 32,
              received: length,
              reason: `key must be exactly 32 bytes, got ${length}`
            })
          )
          expect(yield* Effect.exit(Cipher.encrypt(algorithm, invalid, plaintext))).toStrictEqual(expected)
          expect(yield* Effect.exit(Cipher.decrypt(encrypted, invalid))).toStrictEqual(expected)
        }))
      const zero = yield* bytes(String.repeat(32)("00"))
      const expected = Exit.fail(
        new Cipher.InvalidKey({ expected: 32, received: 32, reason: "key is all-zero (weak key rejected)" })
      )
      expect(yield* Effect.exit(Cipher.encrypt(algorithm, zero, plaintext))).toStrictEqual(expected)
      expect(yield* Effect.exit(Cipher.decrypt(encrypted, zero))).toStrictEqual(expected)
      yield* Effect.forEach(
        Array.make(String.concat("01", String.repeat(31)("00")), String.concat(String.repeat(31)("00"), "01")),
        (fixture) =>
          Effect.gen(function*() {
            const sparse = yield* bytes(fixture)
            const sealed = yield* Cipher.encrypt(algorithm, sparse, plaintext)
            expect(yield* Cipher.decrypt(sealed, sparse)).toEqual(plaintext)
          })
      )
    }).pipe(Effect.provide(Cipher.layer)))
})

it.effect("generates fresh usable keys", () =>
  Effect.gen(function*() {
    const plaintext = yield* bytes(plaintextFixture)
    const first = yield* Cipher.generateKey
    const second = yield* Cipher.generateKey
    expect(first.length).toBe(32)
    expect(second.length).toBe(32)
    expect(first).not.toBe(second)
    expect(first).not.toEqual(second)
    yield* Effect.forEach(Cipher.Algorithm.literals, (algorithm) =>
      Effect.flatMap(Cipher.encrypt(algorithm, first, plaintext), (encrypted) =>
        Cipher.decrypt(encrypted, first)))
  }).pipe(Effect.provide(Cipher.layer)))
