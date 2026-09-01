/**
 * Module-domain errors.
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
  field: Schema.String,
  issue: Schema.Literal("missing-field", "unexpected-field", "duplicate-field", "decode-error"),
  message: Schema.String
}) {}

/**
 * Failure to decode a language-model response against a module's output
 * schema after the configured parsing attempts. `rawOutput` is absent when no
 * textual response was available, and `retryCount` is absent when the caller
 * cannot report an attempt number. The diagnostics are safe to inspect in
 * typed recovery without parsing `message`.
 *
 * @since 0.1.0
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
    message: Schema.String,
    moduleName: Schema.optional(Schema.String)
  }
) {}
