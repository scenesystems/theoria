/**
 * Schema authority for the Statistics domain — defines the canonical domain
 * discriminator, sample input contracts, and the `SummaryStatistics` tagged
 * class carrier. All schemas enforce finite-number validation at decode time,
 * so kernels can assume well-formed numeric input.
 *
 * @since 0.1.0
 * @category schemas
 */

import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"
import { RootFindingResult } from "../Optimization/schema.js"

/**
 * Statistics schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StatisticsDomainSchema = Schema.Struct({
  domain: Schema.Literal("Statistics"),
  stability: DomainStability
})

/**
 * Decodes unknown boundary input into the canonical statistics domain model.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeStatisticsDomain = (input: unknown) =>
  Schema.decodeUnknown(StatisticsDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Statistics",
          contract: "StatisticsDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical statistics domain model at the package boundary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeStatisticsDomain = (domain: StatisticsDomain) =>
  Schema.encode(StatisticsDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Statistics",
          contract: "StatisticsDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Statistics boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Statistics schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type StatisticsDomain = typeof StatisticsDomainSchema.Type

// ---------------------------------------------------------------------------
// Shared finite number schema
// ---------------------------------------------------------------------------

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const OpenUnitIntervalNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0), Schema.lessThan(1))
const SampleSizeNumber = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(2))

// ---------------------------------------------------------------------------
// Operation input schemas — boundary decode contracts
// ---------------------------------------------------------------------------

/**
 * Sample data input — non-empty array of finite numbers. Used as the
 * boundary decode contract for single-sample operations such as `mean`,
 * `variance`, and `summaryStatistics`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SampleInput = Schema.Struct({
  values: Schema.NonEmptyArray(FiniteNumber)
}).annotations({ identifier: "SampleInput" })

/**
 * Two-sample input for comparison operations such as `covariance`.
 * Both `a` and `b` must be non-empty arrays of finite numbers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TwoSampleInput = Schema.Struct({
  a: Schema.NonEmptyArray(FiniteNumber),
  b: Schema.NonEmptyArray(FiniteNumber)
}).annotations({ identifier: "TwoSampleInput" })

/**
 * Summary statistics result carrier — a `Schema.TaggedClass` holding
 * mean, variance, standard deviation, min, max, and count.
 *
 * @since 0.1.0
 * @category schemas
 */
export class SummaryStatistics extends Schema.TaggedClass<SummaryStatistics>()("SummaryStatistics", {
  mean: FiniteNumber,
  variance: FiniteNumber,
  standardDeviation: FiniteNumber,
  min: FiniteNumber,
  max: FiniteNumber,
  count: Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.greaterThanOrEqualTo(1))
}) {}

/**
 * Alternative-hypothesis selector shared by inferential reports.
 *
 * @since 0.3.0
 * @category schemas
 */
export const HypothesisAlternative = Schema.Literal("twoSided", "greater", "less")

/**
 * Released alternative-hypothesis union.
 *
 * @since 0.3.0
 * @category models
 */
export type HypothesisAlternativeType = typeof HypothesisAlternative.Type

/**
 * Canonical confidence-interval envelope shared by inference reports.
 *
 * `null` bounds represent one-sided intervals where the unbounded side is not
 * part of the released surface.
 *
 * @since 0.3.0
 * @category schemas
 */
export class ConfidenceInterval extends Schema.Class<ConfidenceInterval>("ConfidenceInterval")({
  confidenceLevel: OpenUnitIntervalNumber,
  lower: Schema.NullOr(FiniteNumber),
  upper: Schema.NullOr(FiniteNumber)
}) {}

/**
 * Boundary contract for confidence intervals over one sample mean.
 *
 * @since 0.3.0
 * @category schemas
 */
export const MeanConfidenceIntervalInput = Schema.Struct({
  values: Schema.NonEmptyArray(FiniteNumber),
  confidenceLevel: Schema.optional(OpenUnitIntervalNumber),
  alternative: Schema.optional(HypothesisAlternative)
}).annotations({ identifier: "MeanConfidenceIntervalInput" })

/**
 * Boundary contract for the one-sample t-test.
 *
 * @since 0.3.0
 * @category schemas
 */
export const OneSampleTTestInput = Schema.Struct({
  values: Schema.NonEmptyArray(FiniteNumber),
  nullValue: Schema.optional(FiniteNumber),
  alpha: Schema.optional(OpenUnitIntervalNumber),
  alternative: Schema.optional(HypothesisAlternative)
}).annotations({ identifier: "OneSampleTTestInput" })

/**
 * Boundary contract for the two-sample Welch t-test.
 *
 * @since 0.3.0
 * @category schemas
 */
export const TwoSampleTTestInput = Schema.Struct({
  a: Schema.NonEmptyArray(FiniteNumber),
  b: Schema.NonEmptyArray(FiniteNumber),
  nullValue: Schema.optional(FiniteNumber),
  alpha: Schema.optional(OpenUnitIntervalNumber),
  alternative: Schema.optional(HypothesisAlternative)
}).annotations({ identifier: "TwoSampleTTestInput" })

/**
 * Boundary contract for power analysis over an equal-group mean difference.
 *
 * @since 0.3.0
 * @category schemas
 */
export const PowerForMeanDifferenceInput = Schema.Struct({
  effectSize: FiniteNumber,
  sampleSize: SampleSizeNumber,
  alpha: Schema.optional(OpenUnitIntervalNumber),
  alternative: Schema.optional(HypothesisAlternative)
}).annotations({ identifier: "PowerForMeanDifferenceInput" })

/**
 * Boundary contract for sample-size inversion over an equal-group mean difference.
 *
 * @since 0.3.0
 * @category schemas
 */
export const SampleSizeForTargetPowerInput = Schema.Struct({
  effectSize: FiniteNumber,
  targetPower: OpenUnitIntervalNumber,
  alpha: Schema.optional(OpenUnitIntervalNumber),
  alternative: Schema.optional(HypothesisAlternative),
  maxSampleSize: Schema.optional(SampleSizeNumber)
}).annotations({ identifier: "SampleSizeForTargetPowerInput" })

/**
 * Method selector shared by the released t-test reports.
 *
 * @since 0.3.0
 * @category schemas
 */
export const TTestMethod = Schema.Literal("oneSampleTTest", "twoSampleTTest")

/**
 * Released confidence-interval report for one-sample mean estimation.
 *
 * @since 0.3.0
 * @category schemas
 */
export class MeanConfidenceIntervalReport
  extends Schema.Class<MeanConfidenceIntervalReport>("MeanConfidenceIntervalReport")({
    estimate: FiniteNumber,
    standardError: FiniteNumber,
    degreesOfFreedom: FiniteNumber,
    alternative: HypothesisAlternative,
    interval: ConfidenceInterval
  })
{}

/**
 * Released t-test report shared by one-sample and two-sample mean comparisons.
 *
 * @since 0.3.0
 * @category schemas
 */
export class TTestReport extends Schema.Class<TTestReport>("TTestReport")({
  method: TTestMethod,
  estimate: FiniteNumber,
  nullValue: FiniteNumber,
  standardError: FiniteNumber,
  statistic: FiniteNumber,
  pValue: OpenUnitIntervalNumber,
  degreesOfFreedom: FiniteNumber,
  alternative: HypothesisAlternative,
  confidenceLevel: OpenUnitIntervalNumber,
  interval: ConfidenceInterval,
  effectSize: FiniteNumber
}) {}

/**
 * Released power-analysis report for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category schemas
 */
export class PowerAnalysisReport extends Schema.Class<PowerAnalysisReport>("PowerAnalysisReport")({
  effectSize: FiniteNumber,
  sampleSize: SampleSizeNumber,
  alpha: OpenUnitIntervalNumber,
  alternative: HypothesisAlternative,
  degreesOfFreedom: FiniteNumber,
  criticalValue: FiniteNumber,
  noncentrality: FiniteNumber,
  power: OpenUnitIntervalNumber
}) {}

/**
 * Released sample-size inversion report for an equal-group mean difference.
 *
 * @since 0.3.0
 * @category schemas
 */
export class SampleSizeForTargetPowerReport
  extends Schema.Class<SampleSizeForTargetPowerReport>("SampleSizeForTargetPowerReport")({
    effectSize: FiniteNumber,
    targetPower: OpenUnitIntervalNumber,
    alpha: OpenUnitIntervalNumber,
    alternative: HypothesisAlternative,
    sampleSize: SampleSizeNumber,
    achievedPower: OpenUnitIntervalNumber,
    solver: RootFindingResult
  })
{}
