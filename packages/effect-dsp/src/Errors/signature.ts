/**
 * Signature-domain errors.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Invalid signature definition (empty fields, duplicate names, etc.).
 *
 * @since 0.0.0
 * @category errors
 */
export class SignatureError extends Schema.TaggedError<SignatureError>()(
  "SignatureError",
  {
    reason: Schema.String,
    field: Schema.optional(Schema.String)
  }
) {}
