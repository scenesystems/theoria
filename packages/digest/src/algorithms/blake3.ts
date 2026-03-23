/**
 * BLAKE3 multi-mode cryptographic hashing.
 *
 * Primary digest algorithm for all content-addressing, artifact
 * integrity, and persisted cache identity across the Theoria ecosystem.
 * Wraps `@noble/hashes/blake3.js` — audited, zero-dependency, 879K
 * ops/sec for 32B inputs.
 *
 * BLAKE3 provides three distinct operational modes via the Noble API:
 *
 * ### Default hash — `blake3Hash(input)`
 *
 * Standard content hashing. Input must be `Uint8Array`. Output is
 * 32 bytes (`Uint8Array`). Noble call: `blake3(input)`.
 *
 * ### Keyed MAC — `blake3Mac(key, message)`
 *
 * Message authentication without HMAC overhead. Key must be exactly
 * 32 bytes. Output is 32 bytes. Faster than HMAC-SHA256 because
 * BLAKE3 integrates the key natively rather than double-hashing.
 * Noble call: `blake3(message, { key })`.
 *
 * Use for internal integrity checks where the protocol is
 * BLAKE3-native. For webhook verification or external protocol
 * interop, use {@link hmacSha256} instead.
 *
 * ### Derive key — `blake3DeriveKey(context, input, dkLen?)`
 *
 * Domain-separated key derivation using BLAKE3's native KDF mode.
 * The `context` parameter is a hardcoded ASCII string identifying
 * the application domain (e.g., `"effect-search/cache-key"`). The
 * optional `dkLen` parameter controls output length (default 32
 * bytes, max 2^64). Noble call: `blake3(input, { context })` or
 * `blake3(input, { context, dkLen })`.
 *
 * This mode architecturally replaces manual salt concatenation
 * (`salt + ":" + input`). BLAKE3 derive_key guarantees proper
 * domain separation without collision risk from string
 * concatenation, and different context strings are guaranteed to
 * produce independent output even for identical inputs.
 *
 * @example
 * ```ts
 * import { blake3Hash, blake3Mac, blake3DeriveKey } from "@scenesystems/digest"
 * import { utf8ToBytes } from "@noble/hashes/utils.js"
 *
 * // Default hash
 * const hash: Uint8Array = blake3Hash(utf8ToBytes("hello"))
 *
 * // Keyed MAC (key must be exactly 32 bytes)
 * const mac: Uint8Array = blake3Mac(key32, utf8ToBytes("message"))
 *
 * // Domain-separated KDF
 * const derived: Uint8Array = blake3DeriveKey(
 *   "effect-search/cache-key",
 *   utf8ToBytes(canonicalJson)
 * )
 * ```
 *
 * @see {@link hmacSha256} — HMAC-based MAC for external protocol compatibility
 * @see {@link hkdfSha256} — HMAC-based KDF for X25519 key agreement output
 * @see {@link sha256} — secondary algorithm for FIPS compatibility
 * @see {@link digest} — unified pipeline composing canonicalization + hashing + encoding
 * @see {@link toBase64Url} — encode output bytes to base64url
 *
 * @since 0.1.0
 * @category algorithms
 */
