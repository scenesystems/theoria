/**
 * Direct XChaCha20-Poly1305 operations with generated 24-byte nonces.
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { managedNonce } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { validateKey } from "../internal/keyValidation.js"
import { DecryptionFailed, type InvalidKey } from "../schemas/errors.js"

/**
 * Encrypts bytes and returns `24-byte nonce ‖ ciphertext ‖ 16-byte tag`.
 *
 * @remarks
 * The 24-byte nonce comes from the runtime cryptographic random source. This operation has no
 * AAD parameter, so it authenticates only the ciphertext. It does not mutate `key` or `plaintext`
 * and returns a newly allocated array.
 *
 * @param key - Caller-owned 32-byte, non-zero key.
 * @param plaintext - Bytes to encrypt.
 * @returns Fresh nonce-prefixed ciphertext, or {@link InvalidKey}.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xchacha20Encrypt = (
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Uint8Array, InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.sync(() => managedNonce(xchacha20poly1305)(key).encrypt(plaintext))
  })

/**
 * Authenticates and decrypts bytes produced by {@link xchacha20Encrypt}.
 *
 * @remarks
 * This operation has no AAD parameter. It does not mutate either input and returns newly
 * allocated plaintext.
 *
 * @param key - Caller-owned 32-byte, non-zero key.
 * @param ciphertext - `24-byte nonce ‖ ciphertext ‖ 16-byte tag`.
 * @returns Fresh plaintext, or {@link InvalidKey}; wrong keys and malformed or modified
 * input fail with {@link DecryptionFailed} reason `authentication failed`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xchacha20Decrypt = (
  key: Uint8Array,
  ciphertext: Uint8Array
): Effect.Effect<Uint8Array, DecryptionFailed | InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.try({
      try: () => managedNonce(xchacha20poly1305)(key).decrypt(ciphertext),
      catch: () =>
        new DecryptionFailed({
          algorithm: "xchacha20-poly1305",
          reason: "authentication failed"
        })
    })
  })
