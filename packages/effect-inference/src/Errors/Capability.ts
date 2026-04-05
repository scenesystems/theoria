/**
 * Typed capability failures for route resolution and runtime use.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Raised when a resolved route cannot satisfy declared capability
 * requirements.
 *
 * @since 0.1.0
 * @category errors
 */
export class CapabilityMismatch extends Schema.TaggedError<CapabilityMismatch>()(
  "effect-inference/CapabilityMismatch",
  {
    capability: Schema.String,
    reason: Schema.String
  }
) {}
