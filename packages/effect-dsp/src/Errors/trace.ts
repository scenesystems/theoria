/**
 * Trace-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Failure while collecting or projecting execution traces. `moduleName` is
 * optional because scope-level failures can occur before a module invocation
 * is associated with the trace.
 *
 * @since 0.1.0
 * @category errors
 */
export class TraceError extends Schema.TaggedError<TraceError>()(
  "TraceError",
  {
    message: Schema.String,
    moduleName: Schema.optional(Schema.String)
  }
) {}
