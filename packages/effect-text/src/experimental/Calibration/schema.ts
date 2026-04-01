/**
 * Public schemas for experimental calibration profiles and corpora.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { EngineProfileSchema, LayoutLine, LayoutRequest, LayoutSummary, PrepareInput } from "../../Text/schema.js"

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
 * Numeric bounds for the default engine-profile search space.
 *
 * Direction and boolean profile toggles are searched exhaustively; this schema
 * controls the numeric axes exposed through `effect-search`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CalibrationSearchSpaceSpec = Schema.Struct({
  lineFitEpsilon: CalibrationFloatDimension,
  tabWidth: CalibrationIntDimension
})

/**
 * Typed engine-profile search space specification.
 *
 * @since 0.1.0
 * @category models
 */
export type CalibrationSearchSpaceSpecType = typeof CalibrationSearchSpaceSpec.Type
