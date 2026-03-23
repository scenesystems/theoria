/**
 * Typed errors for cryptographic operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * @see {@link signEffect} — the operations that produce these errors
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

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
    algorithm: Schema.String,
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
    algorithm: Schema.String,
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
    algorithm: Schema.String,
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
    algorithm: Schema.String,
    reason: Schema.String
  }
) {}
