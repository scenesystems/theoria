/**
 * Algorithm-tagged digest pair for self-describing integrity checks.
 *
 * Combines a {@link DigestAlgorithm} with a {@link Digest256} value
 * into a portable, self-describing content digest. The tagged form
 * allows consumers to verify both the digest value and which
 * algorithm produced it without external metadata.
 *
 * @see {@link DigestAlgorithm} — the algorithm discriminant
 * @see {@link Digest256} — the digest value
 * @see {@link durableFingerprint} — produces these from structured values
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { Digest256 } from "./Digest256.js"
import { DigestAlgorithm } from "./DigestAlgorithm.js"

/**
 * Algorithm-tagged digest pair for self-describing integrity checks.
 *
 * @since 0.1.0
 * @category schemas
 */
export class ContentDigest extends Schema.Class<ContentDigest>("ContentDigest")({
  algorithm: DigestAlgorithm,
  digest: Digest256
}) {}
