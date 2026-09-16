/**
 * Algorithm-tagged signature results and failures. Verification belongs to each
 * cryptographic suite and always takes an independently selected public key.
 *
 * @since 0.5.0
 * @module
 */
import { Schema } from "effect"

/**
 * Suites that produce signature carriers. Verification-only RSA and P-256 are
 * not signing suites and do not occur in this vocabulary.
 * @since 0.5.0
 * @category schemas
 */
export const Algorithm = Schema.Literal(
  "ed25519",
  "secp256k1-ecdsa",
  "secp256k1-schnorr",
  "ml-dsa-44",
  "ml-dsa-65",
  "ml-dsa-87",
  "slh-dsa-sha2-128f",
  "slh-dsa-sha2-128s",
  "slh-dsa-sha2-192f",
  "slh-dsa-sha2-256f"
).annotations({ identifier: "@scenesystems/sign/Signature/Algorithm" })

/**
 * A supported signing suite.
 * @since 0.5.0
 * @category models
 */
export type Algorithm = typeof Algorithm.Type

/**
 * Detached signature bytes with their suite and the caller-supplied public key.
 * This carrier does not authenticate that key or establish cryptographic validity.
 * Except for Ed25519, signers store the supplied key without proving it matches
 * the secret key. Context and message framing remain the protocol's responsibility.
 *
 * Construction and decoding validate the tag and byte carriers, not their sizes
 * or provenance. Encoded fields are also Uint8Arrays, not JSON strings. Compose
 * byte codecs explicitly at a wire boundary. Nested mutable bytes are neither
 * copied nor given structural equality by this class.
 * @since 0.5.0
 * @category models
 */
export class Signature extends Schema.Class<Signature>("@scenesystems/sign/Signature")({
  algorithm: Algorithm,
  signature: Schema.Uint8ArrayFromSelf,
  publicKey: Schema.Uint8ArrayFromSelf
}) {}

/**
 * Signing rejected input or could not execute. The diagnostic may contain
 * backend text; do not forward it across an untrusted boundary without policy.
 * @since 0.5.0
 * @category errors
 */
export class SigningFailed extends Schema.TaggedError<SigningFailed>("@scenesystems/sign/Signature/SigningFailed")(
  "SigningFailed",
  { algorithm: Algorithm, reason: Schema.String }
) {}

/**
 * A non-strict verifier could not process input. A normal nonmatch is `false`.
 * The diagnostic may contain backend text. Strict verifiers instead use the
 * material-free errors owned by Verification.
 * @since 0.5.0
 * @category errors
 */
export class VerificationFailed extends Schema.TaggedError<VerificationFailed>(
  "@scenesystems/sign/Signature/VerificationFailed"
)("VerificationFailed", { algorithm: Algorithm, reason: Schema.String }) {}
