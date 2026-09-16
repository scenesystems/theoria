/** Noble adapter. Public types and key policy belong to Cipher. @internal */
import { gcm, gcmsiv } from "@noble/ciphers/aes.js"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { randomBytes } from "@noble/ciphers/utils.js"
import type { Context } from "effect"
import { Array, Data, Effect, Match, Number, Schema } from "effect"
import * as Cipher from "../Cipher.js"

const primitive = (algorithm: Cipher.Algorithm) =>
  Match.value(algorithm).pipe(
    Match.when("xchacha20-poly1305", () => xchacha20poly1305),
    Match.when("aes-256-gcm-siv", () => gcmsiv),
    Match.when("aes-256-gcm", () => gcm),
    Match.exhaustive
  )

export const nonceLength = (algorithm: Cipher.Algorithm): number => primitive(algorithm).nonceLength
export const tagLength = (algorithm: Cipher.Algorithm): number => primitive(algorithm).tagLength

const validateKey = (key: Uint8Array): Effect.Effect<void, Cipher.InvalidKey> =>
  Effect.succeed(key).pipe(
    Effect.filterOrFail(
      (bytes) => Number.Equivalence(bytes.length, Cipher.keyLength),
      () =>
        new Cipher.InvalidKey({
          expected: Cipher.keyLength,
          received: key.length,
          reason: `key must be exactly ${Cipher.keyLength} bytes, got ${key.length}`
        })
    ),
    // Summing bounded unsigned bytes examines the entire key, without an early-exit search.
    Effect.filterOrFail(
      (bytes) => Number.greaterThan(Number.sumAll(bytes), 0),
      () =>
        new Cipher.InvalidKey({
          expected: Cipher.keyLength,
          received: key.length,
          reason: "key is all-zero (weak key rejected)"
        })
    ),
    Effect.asVoid
  )

export class EntropyFailed extends Data.TaggedError("EntropyFailed") {}

const secureBytes = (length: number): Effect.Effect<Uint8Array, EntropyFailed> =>
  Effect.try({
    try: () => randomBytes(length),
    catch: () => new EntropyFailed()
  })

// The entropy adapter is injectable here for known-answer and host-failure tests.
// It is not a public deterministic-encryption or caller-supplied nonce API.
export const make = (
  entropy: (length: number) => Effect.Effect<Uint8Array, EntropyFailed> = secureBytes
): Context.Tag.Service<Cipher.Cipher> =>
  Cipher.Cipher.of({
    generateKey: Effect.suspend(() => entropy(Cipher.keyLength)).pipe(
      Effect.tap(validateKey),
      Effect.mapError(() => new Cipher.KeyGenerationFailed())
    ),
    encrypt: (algorithm, key, plaintext) =>
      Effect.gen(function*() {
        yield* validateKey(key)
        const nonce = yield* entropy(nonceLength(algorithm)).pipe(
          Effect.filterOrFail(
            (bytes) => Number.Equivalence(bytes.length, nonceLength(algorithm)),
            () => new EntropyFailed()
          ),
          Effect.mapError(() => new Cipher.EncryptionFailed({ algorithm }))
        )
        const ciphertext = yield* Effect.try({
          try: () => primitive(algorithm)(key, nonce).encrypt(plaintext),
          catch: () => new Cipher.EncryptionFailed({ algorithm })
        })
        return yield* Schema.decode(Schema.Uint8Array)(Array.appendAll(nonce, ciphertext)).pipe(
          Effect.mapError(() => new Cipher.EncryptionFailed({ algorithm }))
        )
      }),
    decrypt: (algorithm, key, ciphertext) =>
      Effect.gen(function*() {
        yield* validateKey(key)
        const [nonce, payload] = Array.splitAt(ciphertext, nonceLength(algorithm))
        const bytes = yield* Effect.all([
          Schema.decode(Schema.Uint8Array)(nonce),
          Schema.decode(Schema.Uint8Array)(payload)
        ]).pipe(Effect.mapError(() => new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" })))
        return yield* Effect.try({
          try: () => primitive(algorithm)(key, bytes[0]).decrypt(bytes[1]),
          catch: () => new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" })
        })
      })
  })
