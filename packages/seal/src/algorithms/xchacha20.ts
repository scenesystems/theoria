/**
 * XChaCha20-Poly1305 authenticated encryption.
 *
 * Recommended default AEAD for all Theoria encryption use cases.
 * XChaCha20-Poly1305 extends ChaCha20-Poly1305 with a 192-bit
 * (24-byte) nonce — large enough for safe random generation without
 * nonce management infrastructure.
 *
 * Wraps `@noble/ciphers/chacha` — audited, zero-dependency. Uses
 * `managedNonce(xchacha20poly1305)` for automatic nonce prepending
 * on encrypt and extraction on decrypt.
 *
 * Security properties:
 * - **192-bit random nonce**: no counter needed, safe for
 *   `crypto.getRandomValues` — birthday bound at 2^96 messages
 * - **Unlimited key wear-out**: no practical message count limit
 *   (unlike AES-GCM's 2^32 invocations per key)
 * - **AEAD**: ciphertext integrity and authenticity guaranteed
 *
 * @see {@link keyValidation} — key size constraints
 * @see {@link encoding} — wire format (nonce ‖ ciphertext ‖ tag)
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link seal} — unified pipeline with algorithm selection
 *
 * @since 0.1.0
 * @category algorithms
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { managedNonce } from "@noble/ciphers/utils.js"
import { Effect, Option } from "effect"
import { validateAssociatedData } from "../internal/associatedData.js"
import { validateKey } from "../internal/keyValidation.js"
import { DecryptionFailed, type InvalidAssociatedData, type InvalidKey } from "../schemas/errors.js"

/**
 * Encrypt `plaintext` using XChaCha20-Poly1305.
 *
 * Returns `nonce ‖ ciphertext ‖ tag` via `managedNonce` — the
 * 24-byte nonce is prepended automatically.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xchacha20Encrypt = (
  key: Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<Uint8Array, InvalidAssociatedData | InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    const aad = yield* validateAssociatedData("xchacha20-poly1305", Option.fromNullable(associatedData))
    return yield* Option.match(aad, {
      onNone: () => Effect.sync(() => managedNonce(xchacha20poly1305)(key).encrypt(plaintext)),
      onSome: (value) => Effect.sync(() => managedNonce(xchacha20poly1305)(key, value).encrypt(plaintext))
    })
  })

/**
 * Decrypt `ciphertext` using XChaCha20-Poly1305.
 *
 * Expects `nonce ‖ ciphertext ‖ tag` as produced by
 * {@link xchacha20Encrypt}. The 24-byte nonce is extracted
 * automatically by `managedNonce`.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xchacha20Decrypt = (
  key: Uint8Array,
  ciphertext: Uint8Array,
  associatedData?: Uint8Array
): Effect.Effect<Uint8Array, DecryptionFailed | InvalidAssociatedData | InvalidKey> =>
  Effect.gen(function*() {
    yield* validateKey(key)
    const aad = yield* validateAssociatedData("xchacha20-poly1305", Option.fromNullable(associatedData))
    return yield* Option.match(aad, {
      onNone: () =>
        Effect.try({
          try: () => managedNonce(xchacha20poly1305)(key).decrypt(ciphertext),
          catch: () =>
            new DecryptionFailed({
              algorithm: "xchacha20-poly1305",
              reason: "authentication failed"
            })
        }),
      onSome: (value) =>
        Effect.try({
          try: () => managedNonce(xchacha20poly1305)(key, value).decrypt(ciphertext),
          catch: () =>
            new DecryptionFailed({
              algorithm: "xchacha20-poly1305",
              reason: "authentication failed"
            })
        })
    })
  })
