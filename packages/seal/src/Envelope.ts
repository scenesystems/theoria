/**
 * JSON-compatible authenticated ciphertext and conversion to nonce-prefixed bytes.
 * The wire representation remains `{ algorithm, nonce, ciphertext }` with base64url strings.
 *
 * @since 0.3.0
 * @module
 */
import { concatBytes } from "@noble/ciphers/utils.js"
import { Effect, Either, Encoding, Schema } from "effect"
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
  const offset = Cipher.nonceLength(algorithm)
  return new Envelope({
    algorithm,
    nonce: Encoding.encodeBase64Url(bytes.subarray(0, offset)),
    ciphertext: Encoding.encodeBase64Url(bytes.subarray(offset))
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
    const nonce = yield* Encoding.decodeBase64Url(self.nonce).pipe(Either.mapLeft(invalidEncoding))
    const ciphertext = yield* Encoding.decodeBase64Url(self.ciphertext).pipe(Either.mapLeft(invalidEncoding))
    if (nonce.length !== Cipher.nonceLength(self.algorithm) || ciphertext.length < Cipher.tagLength(self.algorithm)) {
      return yield* Either.left(
        new Cipher.DecryptionFailed({ algorithm: self.algorithm, reason: "authentication failed" })
      )
    }
    return concatBytes(nonce, ciphertext)
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
 *
 * @since 0.3.0
 * @category decryption
 */
export const decrypt = (
  key: Uint8Array,
  self: Envelope
): Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher> =>
  Effect.flatMap(Effect.suspend(() => toBytes(self)), (bytes) => Cipher.decrypt(self.algorithm, key, bytes))
