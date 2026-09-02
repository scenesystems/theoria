/**
 * Defines Statistics discovery, sample-input, and summary-result schemas.
 *
 * @since 0.1.0
 * @category schemas
 */

import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Accepts the `"Statistics"` discriminator and a recognized stability value.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StatisticsDomainSchema = Schema.Struct({
  domain: Schema.Literal("Statistics"),
  stability: DomainStability
})

/**
 * Decodes Statistics discovery metadata and rejects excess fields.
 *
 * @throws {@link BoundaryDecodeError} in the Effect error channel when the
 * discriminator, stability, or object shape is invalid.
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
 * Encodes validated Statistics discovery metadata.
 *
 * @throws {@link BoundaryEncodeError} in the Effect error channel when a
 * value has been forged outside the `StatisticsDomain` type.
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
 * Identifies Statistics descriptor decode and encode failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

/**
 * Decoded Statistics discovery descriptor.
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
// Operation input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts a non-empty finite numeric sample.
 *
 * @remarks
 * Decoding rejects `NaN`, infinities, and excess fields. Operations that use
 * Bessel's correction impose their two-observation minimum separately.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SampleInput = Schema.Struct({
  values: Schema.NonEmptyArray(FiniteNumber)
}).annotations({ identifier: "SampleInput" })

/**
 * Accepts two non-empty finite numeric samples.
 *
 * @remarks
 * Decoding rejects `NaN`, infinities, and excess fields. Equal lengths and
 * minimum sample sizes are operation-level requirements.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TwoSampleInput = Schema.Struct({
  a: Schema.NonEmptyArray(FiniteNumber),
  b: Schema.NonEmptyArray(FiniteNumber)
}).annotations({ identifier: "TwoSampleInput" })

/**
 * Stores finite descriptive statistics for a non-empty sample.
 *
 * @remarks
 * `variance` uses Bessel's correction when `count` exceeds one. A singleton
 * summary records zero variance and zero standard deviation. The schema
 * requires a positive integer `count` but cannot prove that it matches the
 * sample from which the other fields were calculated.
 *
 * @since 0.1.0
 * @category schemas
 */
export class SummaryStatistics extends Schema.TaggedClass<SummaryStatistics>()("SummaryStatistics", {
  /** Arithmetic mean of the summarized observations. */
  mean: FiniteNumber,
  /** Bessel-corrected sample variance, or zero for a singleton sample. */
  variance: FiniteNumber,
  /** Non-negative square root of `variance`. */
  standardDeviation: FiniteNumber,
  /** Smallest summarized observation. */
  min: FiniteNumber,
  /** Largest summarized observation. */
  max: FiniteNumber,
  /** Positive observation count recorded by the summary. */
  count: Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.greaterThanOrEqualTo(1))
}) {}
