/**
 * Typed errors for cryptographic operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * @see {@link sign} — signing operations that produce these errors
 * @see {@link verify} — verification operations that produce these errors
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"
import { KemAlgorithm } from "./KemAlgorithm.js"
import { CryptoAlgorithm } from "./KeyPair.js"
import { PortableCodecMaterialKind } from "./PortableArtifacts.js"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * Signing operation failed.
 *
 * Carries `algorithm` (which signer was attempted) and `reason`
 * (human-readable explanation).
 *
 * @since 0.1.0
 * @category errors
 */
export class SigningFailed extends Schema.TaggedError<SigningFailed>()(
  "SigningFailed",
  {
    algorithm: SignatureAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Signature verification did not pass.
 *
 * The signature is well-formed but does not match the message
 * and public key. Carries `algorithm` and `reason`.
 *
 * @since 0.1.0
 * @category errors
 */
export class VerificationFailed extends Schema.TaggedError<VerificationFailed>()(
  "VerificationFailed",
  {
    algorithm: SignatureAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Signature data is malformed.
 *
 * Wrong length, invalid encoding, or corrupted bytes — the
 * signature cannot be parsed. Carries `algorithm` and `reason`.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidSignature extends Schema.TaggedError<InvalidSignature>()(
  "InvalidSignature",
  {
    algorithm: SignatureAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Key pair generation failed.
 *
 * Insufficient entropy, invalid parameters, or unsupported
 * algorithm. Carries `algorithm` and `reason`.
 *
 * @since 0.1.0
 * @category errors
 */
export class KeyGenerationFailed extends Schema.TaggedError<KeyGenerationFailed>()(
  "KeyGenerationFailed",
  {
    algorithm: CryptoAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Key agreement operation failed.
 *
 * Carries `algorithm` (which agreement was attempted) and `reason`
 * (human-readable explanation). Raised when ECDH fails due to
 * invalid key material.
 *
 * @since 0.1.0
 * @category errors
 */
export class AgreementFailed extends Schema.TaggedError<AgreementFailed>()(
  "AgreementFailed",
  {
    algorithm: AgreementAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Key encapsulation operation failed.
 *
 * Carries `algorithm` (which KEM was attempted) and `reason`
 * (human-readable explanation). Raised when encapsulation or
 * decapsulation fails.
 *
 * @since 0.1.0
 * @category errors
 */
export class KemFailed extends Schema.TaggedError<KemFailed>()(
  "KemFailed",
  {
    algorithm: KemAlgorithm,
    reason: Schema.String
  }
) {}

/**
 * Portable codec input failed schema validation or base64url decoding.
 *
 * @since 0.2.0
 * @category errors
 */
export class PortableCodecDecodeFailed extends Schema.TaggedError<PortableCodecDecodeFailed>()(
  "PortableCodecDecodeFailed",
  {
    material: PortableCodecMaterialKind,
    reason: Schema.String
  }
) {}
