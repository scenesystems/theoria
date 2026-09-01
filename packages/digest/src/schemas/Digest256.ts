/**
 * Schema for an unpadded base64url representation of 32 digest bytes.
 *
 * The schema validates the unpadded base64url shape, not whether the value was
 * produced by a cryptographic operation. Pattern: `/^[A-Za-z0-9_-]{43}$/`.
 *
 * @see {@link toBase64Url}
 * @see {@link DigestAlgorithm}
 * @see {@link ContentDigest}
 * @see {@link durableFingerprint}
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Validates and brands a 43-character unpadded base64url digest string.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Digest256 = Schema.String.pipe(
  Schema.pattern(/^[A-Za-z0-9_-]{43}$/),
  Schema.brand("Digest256")
)
