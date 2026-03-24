/**
 * Module-domain errors.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Per-field diagnostic emitted when text output parsing fails — identifies the
 * field name, issue type (missing, unexpected, duplicate, or decode error), and
 * a human-readable message.
 *
 * @since 0.0.0
 * @category models
 */
export class ParseFieldDiagnostic extends Schema.Class<ParseFieldDiagnostic>("ParseFieldDiagnostic")({
  field: Schema.String,
  issue: Schema.Literal("missing-field", "unexpected-field", "duplicate-field", "decode-error"),
  message: Schema.String
}) {}

/**
 * Raised when an LLM response cannot be decoded into the expected output
 * schema. Carries the raw output, retry count, and per-field diagnostics for
 * prompt feedback.
 *
 * @since 0.0.0
 * @category errors
 */
export class ParseOutputError extends Schema.TaggedError<ParseOutputError>()(
  "ParseOutputError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    rawOutput: Schema.OptionFromSelf(Schema.String),
    retryCount: Schema.OptionFromSelf(Schema.Number),
    fieldDiagnostics: Schema.optionalWith(Schema.Array(ParseFieldDiagnostic), {
      default: () => []
    })
  }
) {}

/**
 * Raised during module composition when the graph is invalid — duplicate
 * module ids, name collisions, or cycles.
 *
 * @since 0.0.0
 * @category errors
 */
export class CompositionError extends Schema.TaggedError<CompositionError>()(
  "CompositionError",
  {
    message: Schema.String,
    moduleName: Schema.optional(Schema.String)
  }
) {}
