/** Noble adapter. Public types and key policy belong to Cipher. @internal */
import { gcm, gcmsiv } from "@noble/ciphers/aes.js"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { equalBytes, managedNonce, randomBytes } from "@noble/ciphers/utils.js"
import type { Context } from "effect"
import { Effect, Match } from "effect"
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
  Effect.gen(function*() {
    if (key.length !== Cipher.keyLength) {
      return yield* new Cipher.InvalidKey({
        expected: Cipher.keyLength,
        received: key.length,
        reason: `key must be exactly ${Cipher.keyLength} bytes, got ${key.length}`
      })
    }
    if (equalBytes(key, new Uint8Array(Cipher.keyLength))) {
      return yield* new Cipher.InvalidKey({
        expected: Cipher.keyLength,
        received: key.length,
        reason: "key is all-zero (weak key rejected)"
      })
    }
  })

// The entropy adapter is injectable here for known-answer and host-failure tests.
// It is not a public deterministic-encryption or caller-supplied nonce API.
export const make = (entropy: typeof randomBytes = randomBytes): Context.Tag.Service<Cipher.Cipher> => ({
  generateKey: Effect.try({
    try: () => entropy(Cipher.keyLength),
    catch: () => new Cipher.KeyGenerationFailed()
  }).pipe(
    Effect.tap(validateKey),
    Effect.mapError(() => new Cipher.KeyGenerationFailed())
  ),
  encrypt: (algorithm, key, plaintext) =>
    Effect.gen(function*() {
      yield* validateKey(key)
      return yield* Effect.try({
        try: () => managedNonce(primitive(algorithm), entropy)(key).encrypt(plaintext),
        catch: () => new Cipher.EncryptionFailed({ algorithm })
      })
    }),
  decrypt: (algorithm, key, ciphertext) =>
    Effect.gen(function*() {
      yield* validateKey(key)
      return yield* Effect.try({
        try: () => managedNonce(primitive(algorithm))(key).decrypt(ciphertext),
        catch: () => new Cipher.DecryptionFailed({ algorithm, reason: "authentication failed" })
      })
    })
})
