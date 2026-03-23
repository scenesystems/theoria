/**
 * Supported durable digest algorithms as a Schema literal union.
 *
 * ```ts
 * const DigestAlgorithm = Schema.Literal("blake3-256", "sha256")
 * ```
 *
 * `"blake3-256"` is the primary algorithm for all content-addressing,
 * cache identity, and artifact integrity with native domain separation
 * via context mode.
 *
 * `"sha256"` is the secondary for secrets (API key hashing), external
 * protocol compatibility (webhooks), and FIPS contexts.
 *
 * @see {@link blake3Hash} — BLAKE3 algorithm implementation and performance characteristics
 * @see {@link sha256} — SHA-256 algorithm implementation and performance characteristics
 * @see {@link Digest256} — the base64url value this tags
 * @see {@link ContentDigest} — algorithm-tagged digest pair
 *
 * @since 0.1.0
 * @category schemas
 */
