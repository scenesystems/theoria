/**
 * Package-owned serializable errors and their canonical union.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Schema } from "effect"

/** Structural validation failure from signature construction.
 * @since 0.1.0
 * @category errors
 */
export class SignatureError extends Schema.TaggedError<SignatureError>()(
  "SignatureError",
  {
    reason: Schema.String,
    field: Schema.optional(Schema.String)
  }
) {}

/** Machine-readable reason that one response field was rejected.
 * @since 0.1.0
 * @category models
 */
export class ParseFieldDiagnostic
  extends Schema.Class<ParseFieldDiagnostic>("effect-dsp/DspError/ParseFieldDiagnostic")({
    field: Schema.String,
    issue: Schema.Literal("missing-field", "unexpected-field", "duplicate-field", "decode-error"),
    message: Schema.String
  })
{}

/** Failure to decode a language-model response against a module output schema.
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
    fieldDiagnostics: Schema.optionalWith(Schema.Array(ParseFieldDiagnostic), { default: Arr.empty })
  }
) {}

/** Failure of a module composition invariant.
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

/** Terminal BootstrapFewShot failure.
 * @since 0.1.0
 * @category errors
 */
export class BootstrapFailed extends Schema.TaggedError<BootstrapFailed>()(
  "BootstrapFailed",
  {
    message: Schema.String,
    roundsAttempted: Schema.Number,
    totalTraces: Schema.Number,
    threshold: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    acceptedTraces: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    rejectedTraces: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    evaluatedExamples: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    bestScoreSeen: Schema.optionalWith(Schema.Boolean, { default: () => false }),
    bestScore: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    averageScore: Schema.optionalWith(Schema.Number, { default: () => 0 })
  }
) {}

/** Failure to produce a MIPROv2 instruction proposal.
 * @since 0.1.0
 * @category errors
 */
export class InstructionProposalFailed extends Schema.TaggedError<InstructionProposalFailed>()(
  "InstructionProposalFailed",
  {
    message: Schema.String,
    predictorIndex: Schema.Number
  }
) {}

/** Failure to construct or select an optimization trial.
 * @since 0.1.0
 * @category errors
 */
export class AllTrialsFailed extends Schema.TaggedError<AllTrialsFailed>()(
  "AllTrialsFailed",
  {
    message: Schema.String,
    trialCount: Schema.Number
  }
) {}

/** GEPA crossover rejection.
 * @since 0.1.0
 * @category errors
 */
export class MergeRejected extends Schema.TaggedError<MergeRejected>()(
  "MergeRejected",
  {
    message: Schema.String,
    parentA: Schema.String,
    parentB: Schema.String
  }
) {}

/** Serializable metric integration failure.
 * @since 0.1.0
 * @category errors
 */
export class MetricError extends Schema.TaggedError<MetricError>()(
  "MetricError",
  {
    message: Schema.String,
    metricName: Schema.String
  }
) {}

/** Failure of one evaluation example.
 * @since 0.1.0
 * @category errors
 */
export class EvaluationFailed extends Schema.TaggedError<EvaluationFailed>()(
  "EvaluationFailed",
  {
    message: Schema.String,
    index: Schema.Number
  }
) {}

/** Failure to project module data into trace records.
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

/** Failure to serialize or restore module parameter state.
 * @since 0.1.0
 * @category errors
 */
export class SaveLoadError extends Schema.TaggedError<SaveLoadError>()(
  "SaveLoadError",
  {
    message: Schema.String,
    operation: Schema.Literal("save", "load"),
    path: Schema.optional(Schema.String)
  }
) {}

/**
 * Decodes package-owned failures across signatures, modules, optimizers,
 * evaluation, tracing, and persistence.
 *
 * @remarks
 * Provider, platform, dependency, Schema parse, and user callback errors remain
 * outside this union when public operations expose them separately.
 *
 * @since 0.1.0
 * @category errors
 */
export const DspError = Schema.Union(
  SignatureError,
  ParseOutputError,
  CompositionError,
  BootstrapFailed,
  InstructionProposalFailed,
  AllTrialsFailed,
  MergeRejected,
  MetricError,
  EvaluationFailed,
  TraceError,
  SaveLoadError
)

/**
 * Selects the tagged error values decoded by the {@link DspError} schema.
 *
 * @since 0.1.0
 * @category errors
 */
export type DspError = Schema.Schema.Type<typeof DspError>
