/** Noble adapter. Public types and key policy belong to Cipher. @internal */
import { gcm, gcmsiv } from "@noble/ciphers/aes.js"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { concatBytes, randomBytes } from "@noble/ciphers/utils.js"
import type { Context } from "effect"
import { Data, Effect, Match, Number } from "effect"
import * as Cipher from "../Cipher.js"

const primitive = Match.type<Cipher.Algorithm>().pipe(
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

// The entropy adapter is injectable here for known-answer, validation, and lifecycle tests.
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
        return yield* Effect.try({
          try: () => concatBytes(nonce, primitive(algorithm)(key, nonce).encrypt(plaintext)),
          catch: () => new Cipher.EncryptionFailed({ algorithm })
        })
      }),
    decrypt: (algorithm, key, ciphertext) =>
      Effect.gen(function*() {
        yield* validateKey(key)
        return yield* Effect.try({
          try: () => {
            const cipher = primitive(algorithm)
            const nonce = ciphertext.subarray(0, cipher.nonceLength)
            const payload = ciphertext.subarray(cipher.nonceLength)
            return cipher(key, nonce).decrypt(payload)
          },
          catch: () => new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" })
        })
      })
  })
