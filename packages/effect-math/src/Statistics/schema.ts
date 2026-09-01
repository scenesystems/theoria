/**
 * Runtime schemas for Statistics metadata, finite samples, and summary
 * results.
 *
 * @since 0.1.0
 * @category schemas
 */

import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Accepts Statistics metadata with the canonical discriminator and a known
 * stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StatisticsDomainSchema = Schema.Struct({
  domain: Schema.Literal("Statistics"),
  stability: DomainStability
})

/**
 * Admits estimator discovery metadata with the canonical `"Statistics"`
 * discriminator. Unsupported stability values and excess properties fail with
 * {@link BoundaryDecodeError}.
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
 * Decode failures for unknown input or encode failures for forged Statistics descriptors.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Discovery metadata identifying sample estimators and descriptive statistics
 * in a recognized stability lane.
 *
 * @since 0.1.0
 * @category models
 */
export type StatisticsDomain = typeof StatisticsDomainSchema.Type

// ---------------------------------------------------------------------------
// Shared finite number schema
// ---------------------------------------------------------------------------

const FiniteNumber = Schema.Number.pipe(Schema.finite())

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
 * Summary statistics result. Numeric fields must be finite and `count` must
 * be an integer of at least one. Variance and standard deviation use the
 * sample convention in `summaryStatistics` (zero for a singleton).
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
