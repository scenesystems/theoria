/**
 * Trace-domain errors.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Trace collection encountered an unexpected failure.
 *
 * @since 0.0.0
 * @category errors
 */
export class TraceError extends Schema.TaggedError<TraceError>()(
  "TraceError",
  {
    message: Schema.String,
    moduleName: Schema.optional(Schema.String)
  }
) {}
