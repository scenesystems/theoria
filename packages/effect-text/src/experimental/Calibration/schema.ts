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
  text: Schema.String,
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
  lineCount: NonNegativeInt,
  maxLineWidth: NonNegativeNumber,
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
  name: Schema.String,
  prepare: PrepareInput,
  layout: LayoutRequest,
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
  name: Schema.String,
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
  name: Schema.String,
  expected: CalibrationTarget,
  actual: LayoutSummary,
  actualLines: Schema.Array(LayoutLine),
  lineCountDelta: SignedInt,
  maxLineWidthDelta: FiniteNumber,
  lineMismatchCount: NonNegativeInt,
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
  profile: CalibrationProfile,
  caseCount: NonNegativeInt,
  matchedCaseCount: NonNegativeInt,
  totalLineCountError: NonNegativeInt,
  totalMaxLineWidthError: NonNegativeNumber,
  totalLineMismatchCount: NonNegativeInt,
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
  lineMismatchCount: PositiveNumber,
  lineCountError: PositiveNumber,
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
  name: Schema.String,
  direction: Schema.Literal("minimize"),
  scorer: Schema.Literal("weighted-sum"),
  primaryMetric: Schema.Literal("lineMismatchCount"),
  secondaryMetric: Schema.Literal("lineCountError"),
  tertiaryMetric: Schema.Literal("maxLineWidthError"),
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
  low: NonNegativeNumber,
  high: NonNegativeNumber,
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
  low: PositiveInt,
  high: PositiveInt,
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
  lineFitEpsilon: CalibrationFloatDimension,
  tabWidth: CalibrationIntDimension,
  defaultDirection: CalibrationDirectionDimension,
  preferEarlySoftHyphenBreak: CalibrationBooleanDimension,
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
 * Legacy name for `CalibrationSearchDescriptorType`.
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
  snapshot: Study.StudySnapshot,
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
  objective: CalibrationObjectiveMetadata,
  searchDescriptor: CalibrationSearchDescriptor,
  completionReason: StudyEvent.CompletionReasonSchema,
  bestScore: NonNegativeNumber,
  bestLossSummary: CalibrationLossSummary,
  artifacts: CalibrationStudyArtifacts
})

/**
 * Objective, search descriptor, completion reason, best loss, and resumable artifacts.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationOptimizationReportType = typeof CalibrationOptimizationReport.Type
