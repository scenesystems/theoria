import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import * as Envelope from "@scenesystems/seal/Envelope"
import { Effect, Either, Encoding, Equal, Exit, FastCheck, Schema } from "effect"
import { key, plaintext, vectors } from "./fixtures/vectors.js"

describe.each(Cipher.Algorithm.literals)("Envelope %s", (algorithm) => {
  it.effect("splits at the independent wire boundary and copies bytes into base64url strings", () =>
    Effect.gen(function*() {
      const raw = Uint8Array.from({ length: 41 }, (_, i) => i)
      const envelope = Envelope.fromBytes(algorithm, raw)
      const nonce = algorithm === "xchacha20-poly1305"
        ? "AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"
        : "AAECAwQFBgcICQoL"
      const ciphertext = algorithm === "xchacha20-poly1305"
        ? "GBkaGxwdHh8gISIjJCUmJyg"
        : "DA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJyg"
      expect(envelope).toEqual(new Envelope.Envelope({ algorithm, nonce, ciphertext }))
      expect(yield* Envelope.toBytes(envelope)).toEqual(raw)
      raw.fill(255)
      expect(envelope.nonce).toBe(nonce)
      expect(envelope.ciphertext).toBe(ciphertext)
    }))

  it.effect.prop("composes encryption, JSON transport, and authenticated decryption", {
    message: FastCheck.uint8Array({ maxLength: 256 })
  }, ({ message }) =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, message)
      const json = yield* Schema.encode(Schema.parseJson(Envelope.Envelope))(envelope)
      const decoded = yield* Schema.decodeUnknown(Schema.parseJson(Envelope.Envelope))(json)
      expect(Equal.equals(decoded, envelope)).toBe(true)
      expect(yield* Envelope.decrypt(key, decoded)).toEqual(message)
    }).pipe(Effect.provide(Cipher.layer)), { fastCheck: { seed: 20260915, numRuns: 20 } })

  it.effect("rejects shifting the field boundary in either direction", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      const raw = yield* Envelope.toBytes(envelope)
      const nonce = yield* Encoding.decodeBase64Url(envelope.nonce)
      yield* Effect.forEach([nonce.length - 1, nonce.length + 1], (offset) =>
        Effect.gen(function*() {
          const shifted = new Envelope.Envelope({
            algorithm,
            nonce: Encoding.encodeBase64Url(raw.subarray(0, offset)),
            ciphertext: Encoding.encodeBase64Url(raw.subarray(offset))
          })
          expect(yield* Effect.exit(Envelope.decrypt(key, shifted))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
          )
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects corrupt encoding in either field and ciphertext shorter than a tag", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      yield* Effect.forEach([
        new Envelope.Envelope({ ...envelope, nonce: "*" }),
        new Envelope.Envelope({ ...envelope, ciphertext: "*" })
      ], (invalid) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(Envelope.decrypt(key, invalid))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "invalid envelope encoding" }))
          )
        }))
      yield* Effect.forEach([0, 15], (length) =>
        Effect.gen(function*() {
          const invalid = new Envelope.Envelope({
            ...envelope,
            ciphertext: Encoding.encodeBase64Url(new Uint8Array(length))
          })
          expect(yield* Effect.exit(Envelope.decrypt(key, invalid))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
          )
        }))
      const empty = yield* Envelope.encrypt(algorithm, key, new Uint8Array())
      expect(yield* Envelope.decrypt(key, empty)).toEqual(new Uint8Array())
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects changing the recorded algorithm", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      yield* Effect.forEach(Cipher.Algorithm.literals.filter((other) => other !== algorithm), (other) =>
        Effect.gen(function*() {
          const changed = new Envelope.Envelope({ ...envelope, algorithm: other })
          expect(yield* Effect.exit(Envelope.decrypt(key, changed))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm: other, reason: "authentication failed" }))
          )
        }))
    }).pipe(Effect.provide(Cipher.layer)))
})

it.effect("reads published ciphertext as the existing JSON wire shape", () =>
  Effect.forEach(vectors, (vector) =>
    Effect.gen(function*() {
      const secret = yield* Encoding.decodeHex(vector.key)
      const nonce = yield* Encoding.decodeHex(vector.nonce)
      const ciphertext = yield* Encoding.decodeHex(vector.ciphertext)
      const stored = {
        algorithm: vector.algorithm,
        nonce: Encoding.encodeBase64Url(nonce),
        ciphertext: Encoding.encodeBase64Url(ciphertext)
      }
      const envelope = yield* Schema.decodeUnknown(Envelope.Envelope)(stored)
      expect(yield* Schema.encode(Envelope.Envelope)(envelope)).toEqual(stored)
      expect(Encoding.encodeHex(yield* Envelope.decrypt(secret, envelope))).toBe(vector.plaintext)
    })).pipe(Effect.provide(Cipher.layer)))

it.effect("schema admission validates the JSON shape, not authenticity or base64url", () =>
  Effect.gen(function*() {
    yield* Effect.forEach([
      { nonce: "AA", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", nonce: "AA" },
      { algorithm: "unknown", nonce: "AA", ciphertext: "BB" },
      { algorithm: "aes-256-gcm", nonce: 5, ciphertext: "BB" }
    ], (input) =>
      Effect.gen(function*() {
        expect(Either.isLeft(yield* Effect.either(Schema.decodeUnknown(Envelope.Envelope)(input)))).toBe(true)
      }))
    const unauthenticated = yield* Schema.decodeUnknown(Envelope.Envelope)({
      algorithm: "aes-256-gcm",
      nonce: "*",
      ciphertext: "*"
    })
    expect(Envelope.toBytes(unauthenticated)).toStrictEqual(
      Either.left(new Cipher.DecryptionFailed({ algorithm: "aes-256-gcm", reason: "invalid envelope encoding" }))
    )
  }))
