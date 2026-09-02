/**
 * Failures from projecting module data into trace records.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Reports that an invocation payload could not be represented as a trace field record.
 *
 * @remarks
 * Predict and ReAct modules emit this error when Schema encoding or field
 * projection fails. `moduleName` may be absent for integration-defined
 * scope-level failures.
 *
 * @since 0.1.0
 * @category errors
 */
export class TraceError extends Schema.TaggedError<TraceError>()(
  "TraceError",
  {
    /** Diagnostic text identifying the failed trace projection. */
    message: Schema.String,
    /** Module whose invocation was being recorded, when known. */
    moduleName: Schema.optional(Schema.String)
  }
) {}
