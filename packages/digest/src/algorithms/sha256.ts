/**
 * SHA-256 content hashing.
 *
 * Secondary digest algorithm for secrets (API key hashing),
 * external protocol compatibility (webhooks), and regulatory
 * contexts where FIPS familiarity matters.
 *
 * Wraps `@noble/hashes/sha2.js` — audited, zero-dependency, 2M
 * ops/sec for 32B inputs. Input must be `Uint8Array`. Output is
 * 32 bytes (`Uint8Array`).
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
