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
 * import { hmacSha256 } from "@scenesystems/digest"
 * import { utf8ToBytes } from "@noble/hashes/utils.js"
 *
 * const key = utf8ToBytes("webhook-secret")
 * const message = utf8ToBytes('{"event":"charge.succeeded"}')
 * const mac: Uint8Array = hmacSha256(key, message)
 * ```
 *
 * @see {@link sha256} — underlying hash for HMAC-SHA256
 * @see {@link blake3Mac} — BLAKE3 keyed mode for non-legacy MACs
 * @see {@link toBase64Url} — encode output for transport
 *
 * @since 0.1.0
 * @category authentication
 */
