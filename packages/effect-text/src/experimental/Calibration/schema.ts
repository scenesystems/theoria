/**
 * Public schemas for experimental calibration profiles and corpora.
 *
 * @since 0.1.0
 */
import { Statistics } from "@scenesystems/effect-math"
import { Study, StudyEvent } from "@scenesystems/effect-search"
import { Schema } from "effect"

import {
  BaseTextDirection,
  EngineProfileSchema,
  LayoutLine,
  LayoutRequest,
  LayoutSummary,
  PrepareInput
} from "../../Text/schema.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const PositiveNumber = FiniteNumber.pipe(Schema.greaterThan(0))
const SignedInt = Schema.Number.pipe(Schema.int())

/**
 * Expected line projection for a calibration sample.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationTargetLine = Schema.Struct({
  /** Exact visual-order text expected for the line. */
  text: Schema.String,
  /** Exact painted width expected in measurement-service units. */
  width: NonNegativeNumber
})

/**
 * Expected visual text and width for one materialized line.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationTargetLineType = typeof CalibrationTargetLine.Type

/**
 * Expected layout summary for a calibration sample.
 *
 * @remarks
 * Line projections are optional so corpora can start with coarse summary checks
 * and progressively tighten into exact line-text and width expectations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationTarget = Schema.Struct({
  /** Expected number of output lines. */
  lineCount: NonNegativeInt,
  /** Expected greatest painted line width. */
  maxLineWidth: NonNegativeNumber,
  /** Optional exact visual lines; omission disables line-level comparison. */
  lines: Schema.optional(Schema.Array(CalibrationTargetLine))
})

/**
 * Expected aggregate geometry with optional exact line projections.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationTargetType = typeof CalibrationTarget.Type

/**
 * Single calibration sample evaluated against a candidate engine profile.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationCase = Schema.Struct({
  /** Stable case label copied into evaluation results. */
  name: Schema.String,
  /** Input compiled for each candidate profile. */
  prepare: PrepareInput,
  /** Geometry applied to the prepared handle. */
  layout: LayoutRequest,
  /** Expected geometry and optional exact lines. */
  expected: CalibrationTarget
})

/**
 * Named prepare/layout input paired with its expected projection.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationCaseType = typeof CalibrationCase.Type

/**
 * Engine settings named for comparison against an expected-layout corpus.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationProfile = Schema.Struct({
  /** Candidate label copied into the aggregate report. */
  name: Schema.String,
  /** Preparation settings installed while evaluating the candidate. */
  engineProfile: EngineProfileSchema
})

/**
 * Named engine-profile candidate evaluated against a corpus.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationProfileType = typeof CalibrationProfile.Type

/**
 * Per-case evaluation result for a candidate profile.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationCaseResult = Schema.Struct({
  /** Source case label. */
  name: Schema.String,
  /** Expected projection from the corpus. */
  expected: CalibrationTarget,
  /** Aggregate geometry produced by the candidate. */
  actual: LayoutSummary,
  /** Visual lines produced by the candidate. */
  actualLines: Schema.Array(LayoutLine),
  /** Signed `actual.lineCount - expected.lineCount`. */
  lineCountDelta: SignedInt,
  /** Signed `actual.maxLineWidth - expected.maxLineWidth`. */
  maxLineWidthDelta: FiniteNumber,
  /** Positional text or width mismatches; zero when expected lines are omitted. */
  lineMismatchCount: NonNegativeInt,
  /** Whether aggregate geometry and every supplied line expectation match exactly. */
  matched: Schema.Boolean
})

/**
 * Expected and actual projections plus signed width/count deltas and match state.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationCaseResultType = typeof CalibrationCaseResult.Type

/**
 * Aggregate report returned from profile evaluation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationReport = Schema.Struct({
  /** Candidate evaluated by the report. */
  profile: CalibrationProfile,
  /** Number of evaluated cases. */
  caseCount: NonNegativeInt,
  /** Number of cases with exact aggregate and optional line matches. */
  matchedCaseCount: NonNegativeInt,
  /** Sum of absolute line-count deltas. */
  totalLineCountError: NonNegativeInt,
  /** Sum of absolute maximum-width deltas. */
  totalMaxLineWidthError: NonNegativeNumber,
  /** Sum of positional line mismatches. */
  totalLineMismatchCount: NonNegativeInt,
  /** Case results in corpus order. */
  results: Schema.Array(CalibrationCaseResult)
})

/**
 * Candidate profile, aggregate absolute errors, and per-case results.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationReportType = typeof CalibrationReport.Type

/**
 * Explicit score weights used when collapsing calibration fidelity into one
 * optimization objective value.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationScoreWeights = Schema.Struct({
  /** Multiplier applied to each positional line mismatch. */
  lineMismatchCount: PositiveNumber,
  /** Multiplier applied to each absolute line-count delta. */
  lineCountError: PositiveNumber,
  /** Multiplier applied to absolute maximum-width error. */
  maxLineWidthError: PositiveNumber
})

/**
 * Positive multipliers for the three calibration penalties.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationScoreWeightsType = typeof CalibrationScoreWeights.Type

/**
 * Explicit optimization policy for the experimental calibration lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationObjectiveMetadata = Schema.Struct({
  /** Caller-defined label recorded with optimization artifacts. */
  name: Schema.String,
  /** Fixed direction consumed by calibration studies. */
  direction: Schema.Literal("minimize"),
  /** Fixed formula used to collapse penalties. */
  scorer: Schema.Literal("weighted-sum"),
  /** Diagnostic ordering label for the line mismatch penalty. */
  primaryMetric: Schema.Literal("lineMismatchCount"),
  /** Diagnostic ordering label for the line-count penalty. */
  secondaryMetric: Schema.Literal("lineCountError"),
  /** Diagnostic ordering label for the maximum-width penalty. */
  tertiaryMetric: Schema.Literal("maxLineWidthError"),
  /** Positive multipliers used by the weighted sum. */
  scoreWeights: CalibrationScoreWeights
})

/**
 * Weighted minimization policy recorded with optimization artifacts.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationObjectiveMetadataType = typeof CalibrationObjectiveMetadata.Type

const EmptyCalibrationLossSummary = Schema.Struct({
  count: Schema.Literal(0),
  mean: Schema.Literal(0),
  minimum: Schema.Literal(0),
  maximum: Schema.Literal(0),
  variance: Schema.Literal(0),
  standardDeviation: Schema.Literal(0)
})

const NonEmptyCalibrationLossSummary = Statistics.SummaryStatistics.pipe(
  Schema.pick("count", "mean", "min", "max", "variance", "standardDeviation"),
  Schema.rename({
    min: "minimum",
    max: "maximum"
  })
)

/**
 * Summary statistics for per-case experimental calibration losses.
 *
 * @remarks
 * Empty corpora report one explicit zero summary, while non-empty corpora
 * derive their shape from `@scenesystems/effect-math/Statistics.SummaryStatistics` and only
 * rename `min`/`max` into the calibration surface's `minimum`/`maximum` keys.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationLossSummary = Schema.Union(EmptyCalibrationLossSummary, NonEmptyCalibrationLossSummary)

/**
 * Descriptive statistics for weighted per-case losses, including the explicit
 * all-zero representation for an empty corpus.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationLossSummaryType = typeof CalibrationLossSummary.Type

/**
 * Float dimension bounds used when compiling an engine-profile search space.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationFloatDimension = Schema.Struct({
  /** Inclusive sampling lower bound. */
  low: NonNegativeNumber,
  /** Inclusive sampling upper bound; search-space compilation requires `high >= low`. */
  high: NonNegativeNumber,
  /** Optional positive quantization interval. */
  step: Schema.optional(PositiveNumber)
})

/**
 * Non-negative inclusive float bounds and optional positive quantization step.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationFloatDimensionType = typeof CalibrationFloatDimension.Type

/**
 * Integer dimension bounds used when compiling an engine-profile search space.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationIntDimension = Schema.Struct({
  /** Inclusive positive integer lower bound. */
  low: PositiveInt,
  /** Inclusive positive integer upper bound; search-space compilation requires `high >= low`. */
  high: PositiveInt,
  /** Optional positive integer sampling interval. */
  step: Schema.optional(PositiveInt)
})

/**
 * Positive inclusive integer bounds and optional positive step.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationIntDimensionType = typeof CalibrationIntDimension.Type

/**
 * Explicit categorical choices for the base-direction search dimension.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationDirectionDimension = Schema.Struct({
  /** Ordered non-empty direction choices supplied to the sampler. */
  values: Schema.NonEmptyArray(BaseTextDirection)
})

/**
 * Non-empty candidate set for `EngineProfile.defaultDirection`.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationDirectionDimensionType = typeof CalibrationDirectionDimension.Type

/**
 * Explicit boolean choices for one experimental search toggle.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationBooleanDimension = Schema.Struct({
  /** Ordered non-empty toggle choices supplied to the sampler. */
  values: Schema.NonEmptyArray(Schema.Boolean)
})

/**
 * Non-empty candidate set for an engine-profile toggle.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationBooleanDimensionType = typeof CalibrationBooleanDimension.Type

/**
 * Defines the tunable dimensions for experimental engine-profile searches.
 *
 * @remarks
 * `Experimental.Calibration.makeProfileSearchSpace` compiles this descriptor
 * into `effect-search` dimensions that correspond to the runtime profile
 * fields.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationSearchDescriptor = Schema.Struct({
  /** Search bounds for `EngineProfile.lineFitEpsilon`. */
  lineFitEpsilon: CalibrationFloatDimension,
  /** Search bounds for `EngineProfile.tabWidth`. */
  tabWidth: CalibrationIntDimension,
  /** Candidate values for `EngineProfile.defaultDirection`. */
  defaultDirection: CalibrationDirectionDimension,
  /** Candidate values for `EngineProfile.preferEarlySoftHyphenBreak`. */
  preferEarlySoftHyphenBreak: CalibrationBooleanDimension,
  /** Candidate values for `EngineProfile.preferPrefixWidthsForBreakableRuns`. */
  preferPrefixWidthsForBreakableRuns: CalibrationBooleanDimension
})

/**
 * Search dimensions corresponding one-for-one with engine-profile fields.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationSearchDescriptorType = typeof CalibrationSearchDescriptor.Type

/**
 * Compatibility name decoding the same engine-profile search dimensions as `CalibrationSearchDescriptor`.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationSearchSpaceSpec = CalibrationSearchDescriptor

/**
 * Search descriptor projected under the earlier search-space terminology.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationSearchSpaceSpecType = CalibrationSearchDescriptorType

/**
 * Machine-readable study artifacts emitted by experimental optimization runs.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationStudyArtifacts = Schema.Struct({
  /** Cumulative checkpoint after the requested trials finish. */
  snapshot: Study.StudySnapshot,
  /** Events emitted by the current invocation in emission order. */
  eventLog: Schema.Array(StudyEvent.StudyEventSchema)
})

/**
 * Resumable study snapshot and ordered event log from one optimization run.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationStudyArtifactsType = typeof CalibrationStudyArtifacts.Type

/**
 * Structured optimization report emitted by `optimizeProfile`.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationOptimizationReport = Schema.Struct({
  /** Weighted minimization policy used by the study. */
  objective: CalibrationObjectiveMetadata,
  /** Dimensions compiled for candidate sampling. */
  searchDescriptor: CalibrationSearchDescriptor,
  /** Study stop condition reported by Effect Search. */
  completionReason: StudyEvent.CompletionReasonSchema,
  /** Weighted total loss of the selected profile. */
  bestScore: NonNegativeNumber,
  /** Distribution of the selected profile's per-case losses. */
  bestLossSummary: CalibrationLossSummary,
  /** Checkpoint and events available for persistence. */
  artifacts: CalibrationStudyArtifacts
})

/**
 * Persistable metadata and loss diagnostics for the selected profile.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationOptimizationReportType = typeof CalibrationOptimizationReport.Type
