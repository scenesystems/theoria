/**
 * Admission policy and material-free failures shared by the strict Ed25519,
 * P-256, ML-DSA-65, and RSA verifiers. A canonical nonmatch returns false;
 * malformed input and backend failure remain distinct typed failures.
 *
 * @since 0.5.0
 * @module
 */
import { Schema } from "effect"

/**
 * Inclusive strict-verification message bound in bytes. This is Theoria's
 * resource policy, not a limit imposed by the cryptographic standards.
 * @since 0.5.0
 * @category constants
 */
export const maxMessageBytes = 8_192

/**
 * Input falls outside a strict suite's admitted profile. No key, signature,
 * message, context, or diagnostic is retained. The wire tag is stable.
 * @since 0.5.0
 * @category errors
 */
export class InvalidInput extends Schema.TaggedError<InvalidInput>("@scenesystems/sign/Verification/InvalidInput")(
  "InvalidVerificationInput",
  {}
) {}

/**
 * Admitted input reached a backend that could not execute. No input material,
 * backend diagnostic, or underlying exception is retained.
 * @since 0.5.0
 * @category errors
 */
export class Unavailable extends Schema.TaggedError<Unavailable>("@scenesystems/sign/Verification/Unavailable")(
  "VerificationUnavailable",
  {}
) {}
