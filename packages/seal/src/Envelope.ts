/**
 * JSON-compatible authenticated ciphertext and conversion to nonce-prefixed bytes.
 * The wire representation remains `{ algorithm, nonce, ciphertext }` with base64url strings.
 *
 * @since 0.3.0
 * @module
 */
import { Array, Effect, Either, Encoding, Number, Schema } from "effect"
import { dual } from "effect/Function"
import * as Cipher from "./Cipher.js"

/**
 * An algorithm and separately encoded nonce and ciphertext (including the authentication tag).
 * Constructor input and encoded JSON have the same fields; decoding produces a class instance.
 * The schema validates the algorithm and string fields, not base64url, lengths, or authenticity.
 * Use {@link toBytes} to validate encoding and lengths, and {@link decrypt} to authenticate.
 * Contains no key material. The application owns algorithm policy, key storage, and versioning.
 *
 * @example
 * ```ts
 * import { Envelope } from "@scenesystems/seal"
 * import { Schema } from "effect"
 *
 * export const decodeStored = Schema.decodeUnknown(Schema.parseJson(Envelope.Envelope))
 * ```
 *
 * @since 0.3.0
 * @category models
 */
export class Envelope extends Schema.Class<Envelope>("@scenesystems/seal/Envelope")({
  algorithm: Cipher.Algorithm,
  nonce: Schema.String,
  ciphertext: Schema.String
}) {}

/**
 * Splits `nonce ‖ ciphertext ‖ tag` at the selected algorithm's nonce boundary and encodes
 * both fields as unpadded base64url. Pure representation conversion: it neither authenticates
 * nor rejects short input. Does not retain or mutate the source bytes.
 *
 * @since 0.3.0
 * @category conversions
 */
export const fromBytes = (algorithm: Cipher.Algorithm, bytes: Uint8Array): Envelope => {
  const [nonce, ciphertext] = Array.splitAt(bytes, Cipher.nonceLength(algorithm))
  return new Envelope({
    algorithm,
    nonce: Encoding.encodeBase64Url(Schema.decodeSync(Schema.Uint8Array)(nonce)),
    ciphertext: Encoding.encodeBase64Url(Schema.decodeSync(Schema.Uint8Array)(ciphertext))
  })
}

/**
 * Decodes into newly allocated `nonce ‖ ciphertext ‖ tag` bytes, without authenticating them.
 * Rejects malformed base64url with `invalid envelope encoding`; a nonce of the wrong size or
 * ciphertext shorter than its tag fails with `authentication failed`. Checking the separate
 * fields prevents moving bytes across their boundary from silently producing the same message.
 *
 * @since 0.3.0
 * @category conversions
 */
export const toBytes = (self: Envelope): Either.Either<Uint8Array, Cipher.DecryptionFailed> =>
  Either.gen(function*() {
    const invalidEncoding = () =>
      new Cipher.DecryptionFailed({ algorithm: self.algorithm, reason: "invalid envelope encoding" })
    const invalidLength = () =>
      new Cipher.DecryptionFailed({ algorithm: self.algorithm, reason: "authentication failed" })
    const nonce = yield* Encoding.decodeBase64Url(self.nonce).pipe(Either.mapLeft(invalidEncoding))
    const ciphertext = yield* Encoding.decodeBase64Url(self.ciphertext).pipe(Either.mapLeft(invalidEncoding))
    yield* Either.liftPredicate(
      (bytes: Uint8Array) => Number.Equivalence(bytes.length, Cipher.nonceLength(self.algorithm)),
      invalidLength
    )(nonce)
    yield* Either.liftPredicate(
      (bytes: Uint8Array) => Number.greaterThanOrEqualTo(bytes.length, Cipher.tagLength(self.algorithm)),
      invalidLength
    )(ciphertext)
    return Schema.decodeSync(Schema.Uint8Array)(Array.appendAll(nonce, ciphertext))
  })

/**
 * Encrypts with a fresh secure nonce and records the selected algorithm in an envelope.
 * Requires a `Cipher` backend and the same key policy as `Cipher.encrypt`. No AAD is accepted.
 *
 * @since 0.3.0
 * @category encryption
 */
export const encrypt = (
  algorithm: Cipher.Algorithm,
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Envelope, Cipher.InvalidKey | Cipher.EncryptionFailed, Cipher.Cipher> =>
  Cipher.encrypt(algorithm, key, plaintext).pipe(Effect.map((bytes) => fromBytes(algorithm, bytes)))

/**
 * Validates envelope encoding and lengths, then authenticates with its recorded algorithm.
 * Returns newly allocated plaintext, without mutating inputs. Failures never expose key or
 * plaintext bytes. The algorithm field is not AAD: protocols must enforce their chosen algorithm.
 * Call as `decrypt(self, key)` or compose with `Effect.flatMap(decrypt(key))`.
 *
 * @since 0.3.0
 * @category decryption
 */
export const decrypt: {
  (
    key: Uint8Array
  ): (self: Envelope) => Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher>
  (
    self: Envelope,
    key: Uint8Array
  ): Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher>
} = dual(2, (
  self: Envelope,
  key: Uint8Array
): Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher> =>
  Effect.flatMap(Effect.suspend(() => toBytes(self)), (bytes) => Cipher.decrypt(self.algorithm, key, bytes)))
