/**
 * Algorithm-tagged digest pair for self-describing integrity checks.
 *
 * Combines a {@link DigestAlgorithm} with a {@link Digest256} value
 * into a portable, self-describing content digest. The tagged form
 * allows consumers to verify both the digest value and which
 * algorithm produced it without external metadata.
 *
 * ```ts
 * class ContentDigest extends Schema.Class<ContentDigest>("ContentDigest")({
 *   algorithm: DigestAlgorithm,
 *   digest: Digest256
 * }) {}
 * ```
 *
 * **Relationship to existing units:**
 * - `ContentHash` — semantic brand for BLAKE3-256 content addresses
 * - `ProtocolHash` — semantic brand for BLAKE3-256 protocol pins
 * - `ApiKeyHash` — semantic brand for SHA-256 key lookups
 *
 * All are specializations of this base pair.
 *
 * @see {@link DigestAlgorithm} — the algorithm discriminant
 * @see {@link Digest256} — the digest value
 * @see {@link durableFingerprint} — produces these from structured values
 *
 * @since 0.1.0
 * @category schemas
 */
