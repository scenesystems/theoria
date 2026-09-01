/**
 * Schema for carrying a digest with the algorithm required to verify it.
 *
 * The schema validates the algorithm identifier and encoded digest shape. It
 * does not prove that the digest matches any content.
 *
 * @see {@link DigestAlgorithm}
 * @see {@link Digest256}
 * @see {@link durableFingerprint}
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"
import { Digest256 } from "./Digest256.js"
import { DigestAlgorithm } from "./DigestAlgorithm.js"

/**
 * A digest value paired with the algorithm needed for verification.
 *
 * @since 0.1.0
 * @category schemas
 */
export class ContentDigest extends Schema.Class<ContentDigest>("ContentDigest")({
  /** Algorithm needed to interpret and verify `digest`. */
  algorithm: DigestAlgorithm,
  /** Unpadded base64url encoding of the 32 digest bytes. */
  digest: Digest256
}) {}
