/**
 * Response parsing and module graph validation failures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Machine-readable reason that one response field could not be accepted.
 * `issue` distinguishes response shape errors from schema decoding errors;
 * parsers retain all diagnostics so retry prompts can address more than the
 * first malformed field.
 *
 * @since 0.1.0
 * @category models
 */
export class ParseFieldDiagnostic extends Schema.Class<ParseFieldDiagnostic>("ParseFieldDiagnostic")({
  /** Output field involved in the issue, or `$` for a schema-level issue. */
  field: Schema.String,
  /** Machine-readable reason the response field was rejected. */
  issue: Schema.Literal("missing-field", "unexpected-field", "duplicate-field", "decode-error"),
  /** Parser or Schema diagnostic suitable for retry feedback. */
  message: Schema.String
}) {}

/**
 * Reports a language-model response that could not satisfy a module output schema.
 *
 * @remarks
 * `rawOutput` retains provider text without redaction. `retryCount` is absent
 * when no retry policy supplied an attempt count. Field diagnostics retain all
 * issues found during protocol and schema decoding so recovery code does not
 * need to parse `message`.
 *
 * @since 0.1.0
 * @category errors
 */
export class ParseOutputError extends Schema.TaggedError<ParseOutputError>()(
  "ParseOutputError",
  {
    /** Summary of the parse or decode failure. */
    message: Schema.String,
    /** Module whose output schema rejected the response. */
    moduleName: Schema.String,
    /** Unredacted provider response, when textual output was available. */
    rawOutput: Schema.OptionFromSelf(Schema.String),
    /** Number of completed retries reported by the active parse policy. */
    retryCount: Schema.OptionFromSelf(Schema.Number),
    /** Field-level issues; omitted encoded values decode to an empty array. */
    fieldDiagnostics: Schema.optionalWith(Schema.Array(ParseFieldDiagnostic), {
      default: () => []
    })
  }
) {}

/**
 * Rejects a module graph before it can run. Composition uses this error for
 * duplicate module identities, name collisions, cycles, and incompatible
 * pipeline boundaries; `moduleName` is present when the fault can be assigned
 * to one node.
 *
 * @since 0.1.0
 * @category errors
 */
export class CompositionError extends Schema.TaggedError<CompositionError>()(
  "CompositionError",
  {
    /** Diagnostic text naming the violated graph invariant. */
    message: Schema.String,
    /** Node associated with the violation, when one can be identified. */
    moduleName: Schema.optional(Schema.String)
  }
) {}
