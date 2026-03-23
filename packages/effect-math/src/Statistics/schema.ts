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
