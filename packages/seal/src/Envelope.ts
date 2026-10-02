/**
 * Base64url transport for authenticated ciphertext. Decoding produces byte-valued
 * Cipher.Encrypted data; authentication remains the Cipher backend's responsibility.
 * @since 0.3.0
 * @module
 */
import { Effect, Schema } from "effect"
import { dual } from "effect/Function"
import * as Cipher from "./Cipher.js"

/**
 * Encodes encrypted data as { algorithm, nonce, ciphertext } with base64url strings.
 * Decoding validates encoding and allocates fresh byte fields, but does not authenticate
 * or enforce algorithm-specific lengths. Use Cipher.decrypt after decoding.
 * The algorithm is metadata, not AAD; applications must enforce their protocol policy.
 * @since 0.3.0
 * @category codecs
 */
export const Envelope = Cipher.Encrypted.mapFields((fields) => ({
  ...fields,
  nonce: Schema.Uint8ArrayFromBase64Url,
  ciphertext: Schema.Uint8ArrayFromBase64Url
})).pipe(Schema.decodeTo(Cipher.Encrypted))

/**
 * The string-valued envelope used for storage and transport.
 * @since 0.3.0
 * @category models
 */
export type Encoded = typeof Envelope.Encoded

/**
 * Encrypts with fresh secure entropy and encodes the result for transport.
 * Encoding failures are sanitized; errors retain no input or primitive diagnostics.
 * @since 0.3.0
 * @category encryption
 */
export const encrypt = (
  algorithm: Cipher.Algorithm,
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Encoded, Cipher.InvalidKey | Cipher.EncryptionFailed, Cipher.Cipher> =>
  Cipher.encrypt(algorithm, key, plaintext).pipe(
    Effect.flatMap((encrypted) =>
      Schema.encodeEffect(Envelope)(encrypted).pipe(
        Effect.mapError(() => new Cipher.EncryptionFailed({ algorithm }))
      )
    )
  )

/**
 * Decodes a typed transport envelope and authenticates its bytes. Admit unknown
 * stored data with Schema.decodeUnknownEffect(Envelope), then use Cipher.decrypt.
 * Supports receiver-first and pipeable forms. No default backend is installed.
 * @since 0.3.0
 * @category decryption
 */
export const decrypt: {
  (
    key: Uint8Array
  ): (self: Encoded) => Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher>
  (
    self: Encoded,
    key: Uint8Array
  ): Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher>
} = dual(2, (
  self: Encoded,
  key: Uint8Array
): Effect.Effect<Uint8Array, Cipher.InvalidKey | Cipher.DecryptionFailed, Cipher.Cipher> =>
  Schema.decodeEffect(Envelope)(self).pipe(
    Effect.mapError(() =>
      new Cipher.DecryptionFailed({ algorithm: self.algorithm, reason: "invalid envelope encoding" })
    ),
    Effect.flatMap((encrypted) => Cipher.decrypt(encrypted, key))
  ))
