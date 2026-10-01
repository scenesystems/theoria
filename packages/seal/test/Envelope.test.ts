import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import * as Envelope from "@scenesystems/seal/Envelope"
import {
  Array,
  Effect,
  Either,
  Encoding,
  Equal,
  Exit,
  FastCheck,
  Match,
  Number,
  Predicate,
  Schema,
  Tuple
} from "effect"
import { key, plaintext, vectors } from "./fixtures/vectors.js"

describe.each(Cipher.Algorithm.literals)("Envelope %s", (algorithm) => {
  it.effect("splits at the independent wire boundary and decodes into independently owned buffers", () =>
    Effect.gen(function*() {
      const raw = yield* Schema.decode(Schema.Uint8Array)(Array.range(0, 40))
      const envelope = Envelope.fromBytes(algorithm, raw)
      const [nonce, ciphertext] = Match.value(algorithm).pipe(
        Match.when(
          "xchacha20-poly1305",
          () => Tuple.make("AAECAwQFBgcICQoLDA0ODxAREhMUFRYX", "GBkaGxwdHh8gISIjJCUmJyg")
        ),
        Match.whenOr(
          "aes-256-gcm",
          "aes-256-gcm-siv",
          () => Tuple.make("AAECAwQFBgcICQoL", "DA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJyg")
        ),
        Match.exhaustive
      )
      expect(envelope).toEqual(new Envelope.Envelope({ algorithm, nonce, ciphertext }))
      const first = yield* Envelope.toBytes(envelope)
      const second = yield* Envelope.toBytes(envelope)
      expect(first).toEqual(raw)
      expect(second).toEqual(raw)
      expect(first.buffer).not.toBe(raw.buffer)
      expect(second.buffer).not.toBe(first.buffer)
    }))

  it.effect.prop("composes encryption, JSON transport, and authenticated decryption", {
    message: FastCheck.uint8Array({ maxLength: 256 })
  }, ({ message }) =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, message)
      const json = yield* Schema.encode(Schema.parseJson(Envelope.Envelope))(envelope)
      const decoded = yield* Schema.decodeUnknown(Schema.parseJson(Envelope.Envelope))(json)
      expect(Equal.equals(decoded, envelope)).toBe(true)
      expect(yield* Envelope.decrypt(decoded, key)).toEqual(message)
    }).pipe(Effect.provide(Cipher.layer)), { fastCheck: { seed: 20260915, numRuns: 20 } })

  it.effect("rejects shifting the field boundary in either direction", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      const raw = yield* Envelope.toBytes(envelope)
      const nonce = yield* Encoding.decodeBase64Url(envelope.nonce)
      yield* Effect.forEach(Array.make(Number.decrement(nonce.length), Number.increment(nonce.length)), (offset) =>
        Effect.gen(function*() {
          const shiftedNonce = yield* Schema.decode(Schema.Uint8Array)(Array.take(raw, offset))
          const shiftedCiphertext = yield* Schema.decode(Schema.Uint8Array)(Array.drop(raw, offset))
          const shifted = new Envelope.Envelope({
            algorithm,
            nonce: Encoding.encodeBase64Url(shiftedNonce),
            ciphertext: Encoding.encodeBase64Url(shiftedCiphertext)
          })
          expect(yield* Effect.succeed(shifted).pipe(Effect.flatMap(Envelope.decrypt(key)), Effect.exit)).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
          )
        }))
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects corrupt encoding in either field and ciphertext shorter than a tag", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      yield* Effect.forEach(
        Array.make(
          new Envelope.Envelope({ ...envelope, nonce: "*" }),
          new Envelope.Envelope({ ...envelope, ciphertext: "*" })
        ),
        (invalid) =>
          Effect.gen(function*() {
            expect(yield* Effect.exit(Envelope.decrypt(invalid, key))).toStrictEqual(
              Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "invalid envelope encoding" }))
            )
          })
      )
      yield* Effect.forEach(Array.make(0, 15), (length) =>
        Effect.gen(function*() {
          const truncated = yield* Schema.decode(Schema.Uint8Array)(Array.take(Array.replicate(0, 15), length))
          const invalid = new Envelope.Envelope({
            ...envelope,
            ciphertext: Encoding.encodeBase64Url(truncated)
          })
          expect(yield* Effect.exit(Envelope.decrypt(invalid, key))).toStrictEqual(
            Exit.fail(new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" }))
          )
        }))
      const emptyMessage = yield* Schema.decode(Schema.Uint8Array)(Array.empty<number>())
      const empty = yield* Envelope.encrypt(algorithm, key, emptyMessage)
      expect(yield* Envelope.decrypt(empty, key)).toEqual(emptyMessage)
    }).pipe(Effect.provide(Cipher.layer)))

  it.effect("rejects changing the recorded algorithm", () =>
    Effect.gen(function*() {
      const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
      yield* Effect.forEach(Array.filter(Cipher.Algorithm.literals, Predicate.not(Equal.equals(algorithm))), (other) =>
        Effect.gen(function*() {
          const changed = new Envelope.Envelope({ ...envelope, algorithm: other })
          expect(yield* Effect.exit(Envelope.decrypt(changed, key))).toStrictEqual(
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
      expect(Encoding.encodeHex(yield* Envelope.decrypt(envelope, secret))).toBe(vector.plaintext)
      const opened = yield* Schema.decodeUnknown(Envelope.Envelope)(stored).pipe(
        Effect.flatMap(Envelope.decrypt(secret))
      )
      expect(Encoding.encodeHex(opened)).toBe(vector.plaintext)
    })).pipe(Effect.provide(Cipher.layer)))

it.effect("schema admission validates the JSON shape, not authenticity or base64url", () =>
  Effect.gen(function*() {
    yield* Effect.forEach(
      Array.make(
        { nonce: "AA", ciphertext: "BB" },
        { algorithm: "aes-256-gcm", ciphertext: "BB" },
        { algorithm: "aes-256-gcm", nonce: "AA" },
        { algorithm: "unknown", nonce: "AA", ciphertext: "BB" },
        { algorithm: "aes-256-gcm", nonce: 5, ciphertext: "BB" }
      ),
      (input) =>
        Effect.gen(function*() {
          expect(Either.isLeft(yield* Effect.either(Schema.decodeUnknown(Envelope.Envelope)(input)))).toBe(true)
        })
    )
    const unauthenticated = yield* Schema.decodeUnknown(Envelope.Envelope)({
      algorithm: "aes-256-gcm",
      nonce: "*",
      ciphertext: "*"
    })
    expect(Envelope.toBytes(unauthenticated)).toStrictEqual(
      Either.left(new Cipher.DecryptionFailed({ algorithm: "aes-256-gcm", reason: "invalid envelope encoding" }))
    )
  }))
