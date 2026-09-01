/**
 * Direct AES-256-GCM operations with generated 12-byte nonces.
 *
 * @since 0.1.0
 * @category algorithms
 */

import { gcm } from "@noble/ciphers/aes.js"
import { managedNonce } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { validateKey } from "../internal/keyValidation.js"
import { DecryptionFailed, type InvalidKey } from "../schemas/errors.js"

/**
 * Encrypts with AES-256-GCM using a fresh generated nonce and returns
 * `12-byte nonce ‖ ciphertext ‖ 16-byte tag`.
 *
 * @remarks
 * Nonces come from the runtime cryptographic random source. This operation has no AAD parameter,
 * so it authenticates only the ciphertext. It does not mutate `key` or `plaintext` and returns a
 * newly allocated array. AES-GCM does not tolerate nonce reuse under one key.
 *
 * @param key - Caller-owned 32-byte, non-zero key.
 * @param plaintext - Bytes to encrypt.
 * @returns An Effect with nonce-prefixed ciphertext, or {@link InvalidKey}.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const aesgcmEncrypt = (
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Uint8Array, InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.sync(() => managedNonce(gcm)(key).encrypt(plaintext))
  })

/**
 * Authenticates and decrypts bytes produced by {@link aesgcmEncrypt}.
 *
 * @remarks
 * This operation has no AAD parameter. It does not mutate either input and returns newly
 * allocated plaintext.
 *
 * @param key - Caller-owned 32-byte, non-zero key.
 * @param ciphertext - `12-byte nonce ‖ ciphertext ‖ 16-byte tag`.
 * @returns An Effect with plaintext, or {@link InvalidKey}; wrong keys and malformed or modified
 * input fail with {@link DecryptionFailed} reason `authentication failed`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const aesgcmDecrypt = (
  key: Uint8Array,
  ciphertext: Uint8Array
): Effect.Effect<Uint8Array, DecryptionFailed | InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.try({
      try: () => managedNonce(gcm)(key).decrypt(ciphertext),
      catch: () =>
        new DecryptionFailed({
          algorithm: "aes-256-gcm",
          reason: "authentication failed"
        })
    })
  })
