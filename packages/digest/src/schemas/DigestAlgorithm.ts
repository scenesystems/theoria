/**
 * Schema for the stable digest algorithm identifiers used on the wire.
 *
 * Values are stable wire identifiers used in algorithm-tagged digest strings.
 *
 * @see {@link blake3Hash}
 * @see {@link sha256}
 * @see {@link Digest256}
 * @see {@link ContentDigest}
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
 * The `"blake3-256" | "sha256"` wire identifier accepted by digest operations.
 *
 * @since 0.1.0
 * @category schemas
 */
export type DigestAlgorithm = typeof DigestAlgorithm.Type
