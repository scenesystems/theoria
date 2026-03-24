/**
 * HKDF key derivation functions (RFC 5869).
 *
 * Extract-then-expand key derivation using `@noble/hashes/hkdf.js`.
 * Converts raw key material (e.g., X25519 shared secret) into
 * cryptographically strong symmetric keys of any length.
 *
 * Two variants matching the signing package's needs:
 *
 * - **HKDF-SHA256** — standard key derivation for symmetric keys.
 *   Used after X25519 key agreement in `@scenesystems/sign` to
 *   produce AES-256 keys from raw Diffie-Hellman output.
 * - **HKDF-SHA512** — extended output for deriving multiple keys
 *   from a single shared secret, or when 512-bit intermediate
 *   strength is required.
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
 * import { hkdfSha256, utf8ToBytes } from "@scenesystems/digest"
 * import { Effect, Option } from "effect"
 *
 * // Derive an AES-256 key from raw key material (e.g., X25519 shared secret)
 * const program = Effect.gen(function*() {
 *   const sharedSecret = new Uint8Array(32) // from key agreement
 *   const salt = Option.some(new Uint8Array(32)) // random salt
 *   const info = utf8ToBytes("aes-256-key")
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
 * Derive key material using HKDF-SHA256 (RFC 5869).
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
 * Derive key material using HKDF-SHA512 (RFC 5869).
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
