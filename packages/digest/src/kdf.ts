/**
 * HKDF key derivation functions (RFC 5869).
 *
 * Extract-then-expand key derivation using `@noble/hashes/hkdf.js`.
 * Converts input keying material into output bytes using SHA-256 or SHA-512.
 *
 * Parameters follow RFC 5869 naming:
 * - `ikm` — input keying material (raw secret bytes)
 * - `salt` — optional non-secret random value (improves
 *   extraction; defaults to hash-length zero bytes per RFC)
 * - `info` — context/application-specific info string for domain
 *   separation (e.g., `"effect-search/trial-key"`)
 * - `dkLen` — desired output length in bytes (e.g., 32 for
 *   AES-256)
 *
 * Pure `Uint8Array` in/out. The `info` parameter provides domain
 * separation analogous to BLAKE3's context mode but using the
 * standard HMAC-based construction.
 *
 * @example
 * ```ts
 * import { encodeUtf8, hkdfSha256 } from "@scenesystems/digest"
 * import { Effect, Option } from "effect"
 *
 * // Derive an AES-256 key from raw key material (e.g., X25519 shared secret)
 * const program = Effect.gen(function*() {
 *   const sharedSecret = new Uint8Array(32) // from key agreement
 *   const salt = Option.some(new Uint8Array(32)) // random salt
 *   const info = yield* encodeUtf8("aes-256-key")
 *   const aesKey = yield* hkdfSha256(sharedSecret, salt, info, 32)
 * })
 * ```
 *
 * @see {@link hmacSha256} — HMAC primitive used internally by HKDF
 * @see {@link blake3DeriveKey} — BLAKE3 native KDF alternative
 *
 * @since 0.1.0
 * @category key-derivation
 */

import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { sha512 } from "@noble/hashes/sha2.js"
import { Effect, Option } from "effect"

/**
 * Uses HKDF-SHA256 as defined by RFC 5869.
 *
 * @remarks
 * `Option.none()` supplies a hash-length all-zero salt. Invalid output lengths
 * are defects from the underlying kernel rather than typed failures.
 *
 * @param ikm - Input keying material.
 * @param salt - Salt bytes, or `None` for 32 zero bytes.
 * @param info - Application context bytes.
 * @param dkLen - Requested output length in bytes; RFC 5869 permits at most 8160.
 * @returns Derived key bytes.
 *
 * @since 0.1.0
 * @category key-derivation
 */
export const hkdfSha256 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  dkLen: number
): Effect.Effect<Uint8Array> =>
  Effect.sync(() => hkdf(sha256, ikm, Option.getOrElse(salt, () => new Uint8Array(sha256.outputLen)), info, dkLen))

/**
 * Uses HKDF-SHA512 with RFC 5869 extract-then-expand semantics.
 *
 * @remarks
 * `Option.none()` supplies a hash-length all-zero salt. Invalid output lengths
 * are defects from the underlying kernel rather than typed failures.
 *
 * @param ikm - Input keying material.
 * @param salt - Salt bytes, or `None` for 64 zero bytes.
 * @param info - Application context bytes.
 * @param dkLen - Requested output length in bytes; RFC 5869 permits at most 16320.
 * @returns Derived key bytes.
 *
 * @since 0.1.0
 * @category key-derivation
 */
export const hkdfSha512 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  dkLen: number
): Effect.Effect<Uint8Array> =>
  Effect.sync(() => hkdf(sha512, ikm, Option.getOrElse(salt, () => new Uint8Array(sha512.outputLen)), info, dkLen))
