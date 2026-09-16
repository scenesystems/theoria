/**
 * Authenticated encryption with 256-bit keys and managed cryptographic nonces.
 * Supply {@link layer} at the host boundary. Cipher operations exchange
 * `nonce ‖ ciphertext ‖ tag` bytes; use `Envelope` for JSON storage.
 *
 * @since 0.3.0
 * @module
 */
import { Context, Data, Effect, Layer, Schema } from "effect"
import * as internal from "./internal/cipher.js"

/**
 * Supported AEAD algorithms. These literals are compatibility-sensitive wire identifiers.
 * XChaCha20-Poly1305 is recommended for randomly generated nonces. Both AES modes
 * use 96-bit nonces and require application-owned per-key usage limits.
 *
 * @since 0.3.0
 * @category models
 */
export const Algorithm = Schema.Literal("xchacha20-poly1305", "aes-256-gcm-siv", "aes-256-gcm")
  .annotations({ identifier: "@scenesystems/seal/Cipher/Algorithm" })

/**
 * An algorithm accepted by the cipher service.
 *
 * @since 0.3.0
 * @category models
 */
export type Algorithm = typeof Algorithm.Type

/**
 * A key rejected because its length is not 32 bytes or its contents are all zero.
 * Rejecting an all-zero key is Theoria policy, not an AEAD standard requirement.
 * Diagnostics never contain key bytes. This is an in-process failure, not a wire representation.
 *
 * @since 0.3.0
 * @category errors
 */
export class InvalidKey extends Data.TaggedError("InvalidKey")<{
  readonly expected: number
  readonly received: number
  readonly reason: string
}> {}

/**
 * Malformed envelope encoding or failed authentication. Wrong keys, invalid lengths,
 * and modified data all use `authentication failed`; no primitive exception is exposed.
 * Applications should handle all such failures alike. No error serialization is implied.
 *
 * @since 0.3.0
 * @category errors
 */
export class DecryptionFailed extends Data.TaggedError("DecryptionFailed")<{
  readonly algorithm: Algorithm
  readonly reason: string
}> {}

/**
 * The backend could not encrypt, including failure to obtain a secure nonce.
 * Carries only the algorithm, never key material, plaintext, or backend diagnostics.
 *
 * @since 0.3.0
 * @category errors
 */
export class EncryptionFailed extends Data.TaggedError("EncryptionFailed")<{
  readonly algorithm: Algorithm
}> {}

/**
 * The backend could not obtain a valid key from the runtime CSPRNG.
 *
 * @since 0.3.0
 * @category errors
 */
export class KeyGenerationFailed extends Data.TaggedError("KeyGenerationFailed") {}

/**
 * Key size in bytes for every supported algorithm.
 *
 * @since 0.3.0
 * @category constants
 */
export const keyLength = 32

/**
 * Nonce size in bytes: 24 for XChaCha20-Poly1305, 12 for either AES mode.
 *
 * @since 0.3.0
 * @category getters
 */
export const nonceLength = (algorithm: Algorithm): number => internal.nonceLength(algorithm)

/**
 * Authentication tag size in bytes for the selected algorithm.
 *
 * @since 0.3.0
 * @category getters
 */
export const tagLength = (algorithm: Algorithm): number => internal.tagLength(algorithm)

/**
 * Injectable authenticated-encryption backend. Implementations must validate keys before
 * encryption/decryption, generate fresh secure nonces for encryption, preserve caller buffers,
 * and return newly allocated output. No operation accepts additional authenticated data (AAD).
 *
 * @since 0.3.0
 * @category services
 */
export class Cipher extends Context.Tag("@scenesystems/seal/Cipher")<Cipher, {
  readonly generateKey: Effect.Effect<Uint8Array, KeyGenerationFailed>
  readonly encrypt: (
    algorithm: Algorithm,
    key: Uint8Array,
    plaintext: Uint8Array
  ) => Effect.Effect<Uint8Array, InvalidKey | EncryptionFailed>
  readonly decrypt: (
    algorithm: Algorithm,
    key: Uint8Array,
    ciphertext: Uint8Array
  ) => Effect.Effect<Uint8Array, InvalidKey | DecryptionFailed>
}>() {}

/**
 * Generates a fresh 32-byte key each time the effect runs. Uses the backend's
 * cryptographic random source, never Effect's seedable `Random` service.
 *
 * @since 0.3.0
 * @category constructors
 */
export const generateKey: Effect.Effect<Uint8Array, KeyGenerationFailed, Cipher> = Effect.flatMap(
  Cipher,
  (cipher) => cipher.generateKey
)

/**
 * Encrypts into `nonce ‖ ciphertext ‖ tag` with a fresh CSPRNG nonce.
 * The key must be exactly 32 bytes and not all zero. Inputs must remain unchanged until execution completes.
 * No AAD is accepted. The algorithm is not included in these bytes.
 *
 * @since 0.3.0
 * @category encryption
 */
export const encrypt = (
  algorithm: Algorithm,
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Uint8Array, InvalidKey | EncryptionFailed, Cipher> =>
  Effect.flatMap(Cipher, (cipher) => cipher.encrypt(algorithm, key, plaintext))

/**
 * Authenticates `nonce ‖ ciphertext ‖ tag` and returns fresh plaintext bytes.
 * The key must be exactly 32 bytes and not all zero; authentication failures are deliberately indistinguishable.
 * Neither input is mutated. This operation does not require entropy from the backend.
 *
 * @since 0.3.0
 * @category decryption
 */
export const decrypt = (
  algorithm: Algorithm,
  key: Uint8Array,
  ciphertext: Uint8Array
): Effect.Effect<Uint8Array, InvalidKey | DecryptionFailed, Cipher> =>
  Effect.flatMap(Cipher, (cipher) => cipher.decrypt(algorithm, key, ciphertext))

/**
 * Noble Ciphers backend. Key and nonce generation use the host's `crypto.getRandomValues`;
 * absence or failure of that source is reported through the typed failure channel.
 * Layer construction acquires no resources or entropy. Provide once near the application entrypoint.
 *
 * @since 0.3.0
 * @category layers
 */
export const layer: Layer.Layer<Cipher> = Layer.sync(Cipher, () => internal.make())
