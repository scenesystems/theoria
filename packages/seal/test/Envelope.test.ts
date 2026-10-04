import { describe, expect, it } from "@effect/vitest"
import { Cipher, Envelope } from "@scenesystems/seal"
import { Array, Effect, Equal, Exit, Predicate, Result, Schema } from "effect"
import { Base64Url } from "effect/encoding"
import { key as keyFixture, vectors } from "./fixtures/vectors.js"

const bytes = Schema.decodeEffect(Schema.Uint8ArrayFromHex)

describe.each(Cipher.Algorithm.literals)("Envelope %s", (algorithm) => {
  it.effect.prop("composes JSON transport with authentication and independently owned decoding", {
    plaintext: Schema.Uint8Array.check(Schema.isMaxLength(256))
  }, ({ plaintext }) =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const encrypted = yield* Cipher.encrypt(algorithm, key, plaintext)
      const codec = Schema.fromJsonString(Envelope.Envelope)
      const json = yield* Schema.encodeEffect(codec)(encrypted)
      const first = yield* Schema.decodeEffect(codec)(json)
      const second = yield* Schema.decodeEffect(codec)(json)
      expect(first).toBeInstanceOf(Cipher.Encrypted)
      expect(Equal.equals(first, encrypted)).toBe(true)
      expect(first.nonce.buffer).not.toBe(second.nonce.buffer)
      expect(first.ciphertext.buffer).not.toBe(second.ciphertext.buffer)
      expect(first.nonce.buffer).not.toBe(encrypted.nonce.buffer)
      expect(yield* Cipher.decrypt(first, key)).toEqual(plaintext)
      const stored = yield* Envelope.encrypt(algorithm, key, plaintext)
      expect(yield* Envelope.decrypt(stored, key)).toEqual(plaintext)
      expect(yield* Effect.succeed(stored).pipe(Effect.flatMap(Envelope.decrypt(key)))).toEqual(plaintext)
    }).pipe(Effect.provide(Cipher.layer)), { arbitrary: { seed: 20260915, runs: 20 } })

  it.effect("sanitizes malformed encoding separately from authentication failures", () =>
    Effect.gen(function*() {
      const key = yield* bytes(keyFixture)
      const stored = yield* Envelope.encrypt(algorithm, key, yield* bytes("010203"))
      yield* Effect.forEach(Array.make({ ...stored, nonce: "*" }, { ...stored, ciphertext: "*" }), (invalid) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Envelope.decrypt(invalid, key))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "invalid envelope encoding" }))
          )
        }))
      yield* Effect.forEach(Array.make({ ...stored, nonce: "AA" }, { ...stored, ciphertext: "" }), (invalid) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Envelope.decrypt(invalid, key))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
          )
        }))
      yield* Effect.forEach(Array.filter(Cipher.Algorithm.literals, Predicate.not(Equal.equals(algorithm))), (other) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Envelope.decrypt({ ...stored, algorithm: other }, key))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm: other, reason: "authentication failed" }))
          )
        }))
    }).pipe(Effect.provide(Cipher.layer)))
})

it.effect("decodes independently published fields and encodes the base64url transport representation", () =>
  Effect.forEach(vectors, (vector) =>
    Effect.gen(function*() {
      const key = yield* bytes(vector.key)
      const nonce = yield* bytes(vector.nonce)
      const ciphertext = yield* bytes(vector.ciphertext)
      const stored = {
        algorithm: vector.algorithm,
        nonce: Base64Url.encode(nonce),
        ciphertext: Base64Url.encode(ciphertext)
      }
      const decoded = yield* Schema.decodeEffect(Envelope.Envelope)(stored)
      expect(yield* Schema.encodeEffect(Envelope.Envelope)(decoded)).toEqual(stored)
      expect(yield* Cipher.decrypt(decoded, key)).toEqual(yield* bytes(vector.plaintext))
    })).pipe(Effect.provide(Cipher.layer)))

it.effect("rejects arbitrary invalid transport data through unknown decoding", () =>
  Effect.forEach(
    Array.make(
      { nonce: "AA", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", nonce: "AA" },
      { algorithm: "unknown", nonce: "AA", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", nonce: 5, ciphertext: "BB" }
    ),
    (input) =>
      Effect.gen(function*() {
        expect(Result.isFailure(yield* Effect.result(Schema.decodeUnknownEffect(Envelope.Envelope)(input)))).toBe(true)
      })
  ))
