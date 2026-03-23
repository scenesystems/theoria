/**
 * Typed error taxonomy for cache fingerprinting failures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * @since 0.1.0
 * @category errors
 */
export class FingerprintUnsupportedValue extends Schema.TaggedError<FingerprintUnsupportedValue>()(
  "effect-search/Cache/FingerprintUnsupportedValue",
  {
    valueType: Schema.String,
    reason: Schema.String
  }
) {}
