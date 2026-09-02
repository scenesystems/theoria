/**
 * RFC 2104 HMAC-SHA256 and HMAC-SHA1 message authentication.
 *
 * @remarks
 * The operations accept raw key and message bytes and return tags only. A
 * verifier must compare the received and computed tags with a constant-time
 * byte comparison. HMAC-SHA1 is retained for protocols that require it.
 *
 * @see {@link sha256}
 * @see {@link blake3Mac}
 * @see {@link toBase64Url}
 *
 * @since 0.1.0
 * @category authentication
 */

import { hmac } from "@noble/hashes/hmac.js"
import { sha1 } from "@noble/hashes/legacy.js"
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import { Effect } from "effect"
import { toBase64Url, toHex } from "./encoding.js"

/**
 * Computes the 32-byte HMAC-SHA256 tag defined by RFC 2104.
 *
 * @remarks
 * RFC 2104 hashes keys longer than the SHA-256 block size and pads shorter
 * keys during HMAC processing.
 *
 * @param key - Secret key bytes.
 * @param message - Message bytes.
 * @returns A newly allocated authentication tag.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha256 = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<Uint8Array> => Effect.sync(() => hmac(nobleSha256, key, message))

/**
 * Computes a 20-byte HMAC-SHA1 tag for protocols that still require it.
 *
 * @param key - Secret key bytes.
 * @param message - Message bytes.
 * @returns A newly allocated authentication tag.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha1 = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<Uint8Array> => Effect.sync(() => hmac(sha1, key, message))

/**
 * Computes HMAC-SHA256 and returns its unpadded base64url encoding.
 *
 * @remarks
 * The output is 43 unpadded base64url characters. Signature comparison remains
 * the caller's responsibility.
 *
 * @param key - Secret key bytes.
 * @param message - Message bytes.
 * @returns The encoded HMAC-SHA256 tag.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha256Base64Url = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<string> => Effect.map(hmacSha256(key, message), toBase64Url)

/**
 * Computes HMAC-SHA1 and returns its lowercase hexadecimal encoding.
 *
 * @remarks
 * Use when an external protocol specifies HMAC-SHA1 as lowercase hex.
 * Returns a 40-character string.
 *
 * @param key - Secret key bytes.
 * @param message - Message bytes.
 * @returns The lowercase hexadecimal HMAC-SHA1 tag.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha1Hex = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<string> => Effect.map(hmacSha1(key, message), toHex)
