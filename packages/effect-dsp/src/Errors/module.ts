/**
 * Module-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Per-field diagnostic emitted when text output parsing fails — identifies the
 * field name, issue type (missing, unexpected, duplicate, or decode error), and
 * a human-readable message.
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
 * Raised when an LLM response cannot be decoded into the expected output
 * schema. Carries the raw output, retry count, and per-field diagnostics for
 * prompt feedback.
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
 * Raised during module composition when the graph is invalid — duplicate
 * module ids, name collisions, or cycles.
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

/**
 * Structured failure record for a single `Module.parallel` branch.
 *
 * @since 0.2.0
 * @category models
 */
export class ParallelBranchFailure extends Schema.Class<ParallelBranchFailure>("ParallelBranchFailure")({
  branchIndex: Schema.Number,
  branchModuleName: Schema.String,
  errorTag: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised when `Module.parallel` fails under an explicit failure policy.
 * Captures the selected policy and the structured failures that occurred.
 *
 * @since 0.2.0
 * @category errors
 */
export class ParallelExecutionError extends Schema.TaggedError<ParallelExecutionError>()(
  "ParallelExecutionError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    failurePolicy: Schema.Literal("fail-fast", "collect-all"),
    failures: Schema.Array(ParallelBranchFailure)
  }
) {}

/**
 * Raised when a `programOfThought` planning step produces malformed code that
 * cannot be normalized into an executable program body.
 *
 * @since 0.2.0
 * @category errors
 */
export class ProgramCodeParseError extends Schema.TaggedError<ProgramCodeParseError>()(
  "ProgramCodeParseError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    attempt: Schema.Number,
    rawCode: Schema.String,
    parsedCode: Schema.String
  }
) {}

/**
 * Raised when the injected program-execution boundary accepts a program body
 * but reports an execution failure for that attempt.
 *
 * @since 0.2.0
 * @category errors
 */
export class ProgramExecutionError extends Schema.TaggedError<ProgramExecutionError>()(
  "ProgramExecutionError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    attempt: Schema.Number,
    code: Schema.String
  }
) {}

/**
 * Raised when the injected program-execution boundary itself fails before it
 * can return an execution result for the current attempt.
 *
 * @since 0.2.0
 * @category errors
 */
export class ProgramRuntimeBoundaryError extends Schema.TaggedError<ProgramRuntimeBoundaryError>()(
  "ProgramRuntimeBoundaryError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    attempt: Schema.Number,
    code: Schema.String
  }
) {}
