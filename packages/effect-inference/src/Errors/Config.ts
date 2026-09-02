/**
 * Typed configuration failures for runtime descriptor decoding.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Raised when runtime configuration input cannot be decoded into package-owned
 * descriptor contracts.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidRuntimeConfig extends Schema.TaggedError<InvalidRuntimeConfig>()(
  "effect-inference/InvalidRuntimeConfig",
  {
    /** Rendered Config or Schema issue at the failed boundary. */
    reason: Schema.String
  }
) {}
