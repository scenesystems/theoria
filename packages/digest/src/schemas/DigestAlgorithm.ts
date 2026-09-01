/**
 * Supported durable digest algorithms as a Schema literal union.
 *
 * Values are stable wire identifiers used in algorithm-tagged digest strings.
 *
 * @see {@link blake3Hash} — BLAKE3 byte hashing
 * @see {@link sha256} — SHA-256 byte hashing
 * @see {@link Digest256} — the base64url value this tags
 * @see {@link ContentDigest} — algorithm-tagged digest pair
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Validates the stable wire identifiers `"blake3-256"` and `"sha256"`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DigestAlgorithm = Schema.Literal("blake3-256", "sha256")

/**
 * Union of the wire identifiers accepted by hashing pipelines.
 *
 * @since 0.1.0
 * @category schemas
 */
export type DigestAlgorithm = typeof DigestAlgorithm.Type
