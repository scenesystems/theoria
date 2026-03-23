/**
 * HMAC message authentication codes.
 *
 * Keyed-hash message authentication using `@noble/hashes/hmac.js`
 * per RFC 2104. Two variants match the ecosystem's needs:
 *
 * - **HMAC-SHA256** — webhook signature verification (Stripe,
 *   GitHub), API key derivation, and any context requiring a
 *   PRF keyed by a shared secret.
 * - **HMAC-SHA1** — legacy webhook compatibility only (Shopify,
 *   older GitHub endpoints). New integrations should use SHA-256.
 *
 * Pure `Uint8Array` in/out — key and message are both byte arrays.
 * Callers handle encoding (use `@noble/hashes/utils.js` for
 * `utf8ToBytes` / `hexToBytes` conversions).
 *
 * Output length matches the underlying hash: 32 bytes for SHA-256,
 * 20 bytes for SHA-1. Encode with {@link toBase64Url} or
 * `bytesToHex` as the consumer requires.
 *
 * @example
 * ```ts
 * import { hmacSha256, toBase64Url, utf8ToBytes } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const key = utf8ToBytes("webhook-secret")
 *   const message = utf8ToBytes('{"event":"charge.succeeded"}')
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
 * Compute HMAC-SHA256 of `message` using `key`.
 *
 * Key length is flexible per RFC 2104 — short keys are zero-padded
 * to block size, long keys are hashed to block size internally.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha256 = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<Uint8Array> => Effect.sync(() => hmac(nobleSha256, key, message))

/**
 * Compute HMAC-SHA1 of `message` using `key`.
 *
 * Legacy compatibility only — use {@link hmacSha256} for new
 * integrations. Required by older webhook providers (Shopify,
 * legacy GitHub endpoints).
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
 * Convenience pipeline for webhook signature verification:
 * `hmacSha256(key, message)` → base64url encode. Returns
 * a 43-character string.
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
 * Legacy webhook compatibility only — use {@link hmacSha256Base64Url}
 * for new integrations. Returns a 40-character hex string.
 *
 * @since 0.1.0
 * @category authentication
 */
export const hmacSha1Hex = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<string> => Effect.map(hmacSha1(key, message), toHex)
