/**
 * AES-256-GCM-SIV authenticated encryption.
 *
 * Nonce-misuse resistant AEAD — if a nonce is accidentally reused,
 * only the ability to detect repeated messages is lost; ciphertext
 * integrity and confidentiality are preserved. Preferred when nonce
 * management cannot be guaranteed (e.g. distributed systems).
 *
 * Wraps `@noble/ciphers/aes` — audited, zero-dependency. Uses
 * `managedNonce(gcmsiv)` for automatic 12-byte nonce prepending
 * on encrypt and extraction on decrypt.
 *
 * Security properties:
 * - **Nonce-misuse resistance**: SIV construction derives the tag
 *   from both nonce and plaintext, so repeated (nonce, plaintext)
 *   only reveals equality — no catastrophic failure
 * - **96-bit nonce**: 12 bytes, randomly generated
 * - **Key wear-out**: ~2^48 messages per key (SIV mitigates but
 *   does not eliminate birthday bound concerns)
 *
 * @see {@link keyValidation} — key size constraints
 * @see {@link encoding} — wire format (nonce ‖ ciphertext ‖ tag)
 * @see {@link xchacha20} — recommended default with larger nonce
 * @see {@link aesgcm} — non-SIV variant for compatibility
 * @see {@link seal} — unified pipeline with algorithm selection
 *
 * @since 0.1.0
 * @category algorithms
 */

import { gcmsiv } from "@noble/ciphers/aes.js"
import { managedNonce } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { validateKey } from "../internal/keyValidation.js"
import { DecryptionFailed, type InvalidKey } from "../schemas/errors.js"

/**
 * Encrypt `plaintext` using AES-256-GCM-SIV.
 *
 * Returns `nonce ‖ ciphertext ‖ tag` via `managedNonce` — the
 * 12-byte nonce is prepended automatically.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const aesgcmsivEncrypt = (
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<Uint8Array, InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.sync(() => managedNonce(gcmsiv)(key).encrypt(plaintext))
  })

/**
 * Decrypt `ciphertext` using AES-256-GCM-SIV.
 *
 * Expects `nonce ‖ ciphertext ‖ tag` as produced by
 * {@link aesgcmsivEncrypt}. The 12-byte nonce is extracted
 * automatically by `managedNonce`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const aesgcmsivDecrypt = (
  key: Uint8Array,
  ciphertext: Uint8Array
): Effect.Effect<Uint8Array, DecryptionFailed | InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    return yield* Effect.try({
      try: () => managedNonce(gcmsiv)(key).decrypt(ciphertext),
      catch: () =>
        new DecryptionFailed({
          algorithm: "aes-256-gcm-siv",
          reason: "authentication failed"
        })
    })
  })
