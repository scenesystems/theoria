/**
 * Package-owned serializable errors and their canonical union.
 *
 * @since 0.1.0
 * @module
 */
import { Array as Arr, Effect, Schema } from "effect"
import { Payload } from "./Payload.js"

/** Structural validation failure from signature construction.
 * @since 0.1.0
 * @category errors
 */
export class SignatureError extends Schema.TaggedError<SignatureError>(
  "@scenesystems/effect-dsp/DspError/SignatureError"
)(
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
  extends Schema.Class<ParseFieldDiagnostic>("@scenesystems/effect-dsp/DspError/ParseFieldDiagnostic")({
    field: Schema.String,
    issue: Schema.Literals(["missing-field", "unexpected-field", "duplicate-field", "decode-error"]),
    message: Schema.String
  })
{}

/** Failure to decode a language-model response against a module output schema.
 * @since 0.1.0
 * @category errors
 */
export class ParseOutputError extends Schema.TaggedError<ParseOutputError>(
  "@scenesystems/effect-dsp/DspError/ParseOutputError"
)(
  "ParseOutputError",
  {
    message: Schema.String,
    moduleName: Schema.String,
    rawOutput: Schema.Option(Schema.String),
    retryCount: Schema.Option(Schema.Finite),
    /** Runtime predictor evidence; absent for direct parser calls. @since 0.7.0 */
    context: Schema.optional(Schema.Struct({ predictorPath: Schema.String, input: Payload, prompt: Schema.String })),
    fieldDiagnostics: Schema.Array(ParseFieldDiagnostic).pipe(Schema.withDecodingDefaultType(Effect.sync(Arr.empty)))
  }
) {}

/** Failure of a module composition invariant.
 * @since 0.1.0
 * @category errors
 */
export class CompositionError extends Schema.TaggedError<CompositionError>(
  "@scenesystems/effect-dsp/DspError/CompositionError"
)(
  "CompositionError",
  {
    message: Schema.String,
    moduleName: Schema.optional(Schema.String)
  }
) {}

/** Failure to produce a MIPROv2 instruction proposal.
 * @since 0.1.0
 * @category errors
 */
export class InstructionProposalFailed extends Schema.TaggedError<InstructionProposalFailed>(
  "@scenesystems/effect-dsp/DspError/InstructionProposalFailed"
)(
  "InstructionProposalFailed",
  {
    message: Schema.String,
    predictorIndex: Schema.Finite
  }
) {}

/** Failure to construct or select an optimization trial.
 * @since 0.1.0
 * @category errors
 */
export class AllTrialsFailed extends Schema.TaggedError<AllTrialsFailed>(
  "@scenesystems/effect-dsp/DspError/AllTrialsFailed"
)(
  "AllTrialsFailed",
  {
    message: Schema.String,
    trialCount: Schema.Finite
  }
) {}

/** Invalid MIPRO inputs or exhausted full-validation candidates.
 * @since 0.7.0
 * @category errors
 */
export class MIPROv2Error extends Schema.TaggedError<MIPROv2Error>(
  "@scenesystems/effect-dsp/DspError/MIPROv2Error"
)("MIPROv2Error", {
  reason: Schema.Literals(["invalid-options", "invalid-dataset", "exhausted-candidates"]),
  message: Schema.String
}) {}

/** Invalid GEPA budgets, datasets, or continuation state.
 * @since 0.7.0
 * @category errors
 */
export class GEPAError extends Schema.TaggedError<GEPAError>(
  "@scenesystems/effect-dsp/DspError/GEPAError"
)("GEPAError", {
  reason: Schema.Literals(["invalid-options", "invalid-dataset", "invalid-state"]),
  message: Schema.String
}) {}

/** GEPA crossover rejection.
 * @since 0.1.0
 * @category errors
 */
export class MergeRejected extends Schema.TaggedError<MergeRejected>(
  "@scenesystems/effect-dsp/DspError/MergeRejected"
)(
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
export class MetricError extends Schema.TaggedError<MetricError>(
  "@scenesystems/effect-dsp/DspError/MetricError"
)(
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
export class EvaluationFailed extends Schema.TaggedError<EvaluationFailed>(
  "@scenesystems/effect-dsp/DspError/EvaluationFailed"
)(
  "EvaluationFailed",
  {
    message: Schema.String,
    index: Schema.Finite
  }
) {}

/** Failure to project module data into trace records.
 * @since 0.1.0
 * @category errors
 */
export class TraceError extends Schema.TaggedError<TraceError>(
  "@scenesystems/effect-dsp/DspError/TraceError"
)(
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
export class SaveLoadError extends Schema.TaggedError<SaveLoadError>(
  "@scenesystems/effect-dsp/DspError/SaveLoadError"
)(
  "SaveLoadError",
  {
    message: Schema.String,
    operation: Schema.Literals(["save", "load"]),
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
export const DspError = Schema.Union([
  SignatureError,
  ParseOutputError,
  CompositionError,
  InstructionProposalFailed,
  AllTrialsFailed,
  MIPROv2Error,
  GEPAError,
  MergeRejected,
  MetricError,
  EvaluationFailed,
  TraceError,
  SaveLoadError
])

/**
 * Selects the tagged error values decoded by the {@link DspError} schema.
 *
 * @since 0.1.0
 * @category errors
 */
export type DspError = Schema.Schema.Type<typeof DspError>
