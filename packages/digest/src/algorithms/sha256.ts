/**
 * SHA-256 content hashing.
 *
 * Produces SHA-256 output for formats and protocols that specify SHA-256.
 *
 * For HMAC-SHA256, use {@link hmacSha256} which composes
 * `@noble/hashes/hmac.js` with `@noble/hashes/sha2.js` per
 * RFC 2104.
 *
 * @see {@link blake3Hash} — primary algorithm for content-addressing
 * @see {@link digest} — unified pipeline composing canonicalization + hashing + encoding
 * @see {@link toBase64Url} — encode output bytes to base64url
 *
 * @since 0.1.0
 * @category algorithms
 */

import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import { Effect } from "effect"

/**
 * Produces the 32-byte SHA-256 digest defined by FIPS 180-4.
 *
 * @param input - Bytes to hash; the array is not modified.
 * @returns An Effect that succeeds with a newly allocated digest.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const sha256 = (input: Uint8Array): Effect.Effect<Uint8Array> => Effect.sync(() => nobleSha256(input))
