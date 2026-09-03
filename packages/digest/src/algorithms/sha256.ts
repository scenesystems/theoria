/**
 * SHA-256 hashing for formats and protocols that specify FIPS 180-4.
 *
 * @remarks
 * Operations return raw digest bytes. HMAC-SHA256 is exposed separately by
 * {@link hmacSha256}.
 *
 * @since 0.1.0
 * @category algorithms
 */

import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import { Effect } from "effect"

/**
 * Hashes bytes with SHA-256 as specified by FIPS 180-4.
 *
 * @param input - Bytes to hash; the array is not modified.
 * @returns A newly allocated 32-byte digest.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const sha256 = (input: Uint8Array): Effect.Effect<Uint8Array> => Effect.sync(() => nobleSha256(input))
