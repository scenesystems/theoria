/**
 * Public schemas for experimental calibration profiles and corpora.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { Statistics } from "effect-math"
import { Study, StudyEvent } from "effect-search"

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
 * Typed expected line projection.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationTargetLineType = typeof CalibrationTargetLine.Type

/**
 * Expected layout summary for a calibration sample.
 *
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
 * Typed calibration target.
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
 * Typed calibration sample.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationCaseType = typeof CalibrationCase.Type

/**
 * Candidate profile evaluated by the calibration helpers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationProfile = Schema.Struct({
  name: Schema.String,
  engineProfile: EngineProfileSchema
})

/**
 * Typed calibration profile.
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
 * Typed per-case calibration result.
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
 * Typed calibration report.
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
 * Typed score-weight model.
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
 * Typed optimization-policy model.
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
 * Empty corpora report one explicit zero summary, while non-empty corpora
 * derive their shape from `effect-math/Statistics.SummaryStatistics` and only
 * rename `min`/`max` into the calibration surface's `minimum`/`maximum` keys.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationLossSummary = Schema.Union(EmptyCalibrationLossSummary, NonEmptyCalibrationLossSummary)

/**
 * Typed loss-summary model.
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
 * Typed float dimension bounds.
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
 * Typed integer dimension bounds.
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
 * Typed direction-dimension model.
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
 * Typed boolean-dimension model.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationBooleanDimensionType = typeof CalibrationBooleanDimension.Type

/**
 * Single source of truth for the experimental engine-profile search space.
 *
 * `Experimental.Calibration.makeProfileSearchSpace` compiles this descriptor
 * directly into `effect-search` dimensions so the released optimization knobs
 * never drift away from the runtime profile surface.
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
 * Typed search-descriptor model.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationSearchDescriptorType = typeof CalibrationSearchDescriptor.Type

/**
 * Compatibility alias for the calibration search descriptor schema.
 *
 * @since 0.2.0
 * @category schemas
 */
export const CalibrationSearchSpaceSpec = CalibrationSearchDescriptor

/**
 * Compatibility alias type for the calibration search descriptor.
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
 * Typed study-artifact model.
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
 * Typed optimization-report model.
 *
 * @since 0.2.0
 * @category models
 */
export type CalibrationOptimizationReportType = typeof CalibrationOptimizationReport.Type
