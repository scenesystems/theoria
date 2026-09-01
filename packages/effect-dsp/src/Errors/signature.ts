/**
 * Signature-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Rejects a signature before prompt construction. `reason` describes the
 * violated structural invariant (for example, missing or duplicate fields),
 * while `field` identifies the offending input or output when one exists.
 *
 * @since 0.1.0
 * @category errors
 */
export class SignatureError extends Schema.TaggedError<SignatureError>()(
  "SignatureError",
  {
    reason: Schema.String,
    field: Schema.optional(Schema.String)
  }
) {}
