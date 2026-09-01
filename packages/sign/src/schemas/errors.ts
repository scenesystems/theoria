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
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

/**
 * A direct verifier received input outside its frozen suite profile.
 *
 * @remarks
 * The error is deliberately material-free: it does not retain the algorithm,
 * verification key, signature, message, context, or a backend diagnostic.
 *
 * @since 0.1.1
 * @category errors
 */
export class InvalidVerificationInput extends Schema.TaggedError<InvalidVerificationInput>()(
  "InvalidVerificationInput",
  {}
) {}

/**
 * A direct verifier could not execute its backend after input admission.
 *
 * @remarks
 * The error is deliberately material-free and does not expose provider text
 * or an underlying exception.
 *
 * @since 0.1.1
 * @category errors
 */
export class VerificationUnavailable extends Schema.TaggedError<VerificationUnavailable>()(
  "VerificationUnavailable",
  {}
) {}

/**
 * A signer rejected key/message/entropy input or its backend threw.
 *
 * @remarks
 * Carries `algorithm` (which signer was attempted) and `reason`
 * (human-readable explanation). `reason` may contain backend diagnostics and
 * is not redacted for an untrusted boundary.
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
 * A general signature verifier could not process its input.
 *
 * @remarks
 * A normal cryptographic nonmatch is returned as `false`, not this error.
 * Carries `algorithm` and a potentially backend-derived, non-redacted `reason`.
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
 * Records malformed signature data detected by an application-defined
 * validation boundary.
 *
 * @remarks
 * Carries `algorithm` and a non-redacted `reason`. Package verification
 * operations use `InvalidVerificationInput`, `VerificationUnavailable`, or
 * `VerificationFailed` instead; they do not emit this variant.
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
 * Unified key-generation dispatch could not obtain a key pair from its selected
 * Noble primitive.
 *
 * @remarks
 * Carries the selected `algorithm` and a non-redacted diagnostic `reason`.
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
 * X25519 rejected local or peer key material or could not compute its raw
 * shared secret.
 *
 * @remarks
 * Carries `algorithm` (which agreement was attempted) and `reason`
 * (human-readable explanation). Raised when ECDH fails due to
 * invalid key material. The reason may expose backend diagnostics.
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
 * X-Wing rejected serialized key/ciphertext input or could not complete
 * encapsulation or decapsulation.
 *
 * @remarks
 * Carries `algorithm` (which KEM was attempted) and `reason`
 * (human-readable explanation). Raised when encapsulation or
 * decapsulation fails. The reason may expose backend diagnostics.
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
