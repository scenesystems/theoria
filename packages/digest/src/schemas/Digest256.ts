/**
 * 256-bit digest encoded as base64url (43 chars, no padding).
 *
 * Branded Schema type ensuring only valid digests flow through
 * the type system. Pattern: `/^[A-Za-z0-9_-]{43}$/`.
 *
 * The 43-character length is the natural encoding of 256 bits
 * (32 bytes) in base64url without padding:
 * `ceil(32 * 4 / 3) = 43`.
 *
 * @see {@link toBase64Url} — encoding implementation details
 * @see {@link DigestAlgorithm} — which algorithm produced this digest
 * @see {@link ContentDigest} — self-describing algorithm + digest pair
 * @see {@link durableFingerprint} — produces tagged digest strings containing this value
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * 256-bit digest encoded as base64url (43 chars, no padding).
 *
 * @since 0.1.0
 * @category schemas
 */
export const Digest256 = Schema.String.pipe(
  Schema.pattern(/^[A-Za-z0-9_-]{43}$/),
  Schema.brand("Digest256")
)
