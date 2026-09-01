/**
 * HMAC message authentication codes.
 *
 * Keyed-hash message authentication using `@noble/hashes/hmac.js`
 * per RFC 2104. Two variants match the ecosystem's needs:
 *
 * - **HMAC-SHA256** — protocols requiring a SHA-256 HMAC.
 * - **HMAC-SHA1** — protocols that explicitly specify SHA-1.
 *
 * Pure `Uint8Array` in/out — key and message are both byte arrays.
 * Callers use {@link encodeUtf8} for strict text encoding or the raw-byte
 * decoding APIs appropriate to their wire format.
 *
 * Output length matches the underlying hash: 32 bytes for SHA-256,
 * 20 bytes for SHA-1. Encode with {@link toBase64Url} or
 * {@link toHex} as the consumer requires. These functions compute tags only;
 * callers performing verification must use a constant-time byte comparison.
 *
 * @example
 * ```ts
 * import { encodeUtf8, hmacSha256, toBase64Url } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const key = yield* encodeUtf8("webhook-secret")
 *   const message = yield* encodeUtf8('{"event":"charge.succeeded"}')
 *   const mac = yield* hmacSha256(key, message)
 *   const encoded = toBase64Url(mac)
 * })
 * ```
 *
 * @see {@link sha256} — underlying hash for HMAC-SHA256
 * @see {@link blake3Mac} — BLAKE3 keyed mode for non-legacy MACs
 * @see {@link toBase64Url} — encode output for transport
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
 * Produces the 32-byte HMAC-SHA256 tag.
 *
 * @remarks
 * Key length is flexible per RFC 2104 — short keys are zero-padded
 * to block size, long keys are hashed to block size internally.
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
 * Produces the 20-byte HMAC-SHA1 tag.
 *
 * @remarks
 * Use when an external protocol explicitly specifies HMAC-SHA1.
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
 * Compute HMAC-SHA256 and encode as base64url (no padding).
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
 * Compute HMAC-SHA1 and encode as lowercase hex.
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
