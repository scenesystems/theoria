/**
 * Defines serializable descriptors and numeric input boundaries for distribution operations.
 *
 * @remarks
 * The parameter and evaluation schemas reject non-finite numbers. They do not
 * normalize categorical masses or enforce relationships between fields such
 * as ordered uniform bounds.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Effect, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

/**
 * Accepts the Distribution discovery discriminator and its stability classification.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DistributionDomainSchema = Schema.Struct({
  domain: Schema.Literal("Distribution"),
  stability: DomainStability
})

/**
 * Decoded Distribution discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type DistributionDomain = typeof DistributionDomainSchema.Type

/**
 * Decodes a Distribution discovery descriptor and rejects unknown fields.
 *
 * @throws {@link BoundaryDecodeError} in the Effect error channel when the
 * discriminator, stability, or object shape is invalid.
 *
 * @since 0.1.0
 * @category schemas
 */
export const decodeDistributionDomain = (input: unknown) =>
  Schema.decodeUnknown(DistributionDomainSchema)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Distribution",
          contract: "DistributionDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes a validated Distribution discovery descriptor.
 *
 * @throws {@link BoundaryEncodeError} in the Effect error channel when a
 * value has been forged outside the `DistributionDomain` type.
 *
 * @since 0.1.0
 * @category schemas
 */
export const encodeDistributionDomain = (domain: DistributionDomain) =>
  Schema.encode(DistributionDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Distribution",
          contract: "DistributionDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Identifies Distribution descriptor decode and encode failures.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Shared finite number schemas
// ---------------------------------------------------------------------------

/**
 * Accepts finite JavaScript numbers and rejects `NaN` and infinities.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FiniteNumber = Schema.Number.pipe(Schema.finite())

/**
 * Accepts finite JavaScript numbers greater than zero.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

/**
 * Accepts finite JavaScript numbers greater than or equal to zero.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NonNegativeFiniteNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

/**
 * Accepts finite JavaScript numbers in the closed unit interval.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UnitIntervalNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1)
)

// ---------------------------------------------------------------------------
// Distribution parameter schemas
// ---------------------------------------------------------------------------

/**
 * Accepts a finite normal location and a positive finite scale.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalDistParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalDistParams" })

/**
 * Accepts a finite log-space location and a positive finite log-space scale.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogNormalDistParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "LogNormalDistParams" })

/**
 * Accepts a positive finite exponential rate.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialDistParams = Schema.Struct({
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialDistParams" })

/**
 * Accepts finite uniform bounds without requiring them to be ordered.
 *
 * @remarks
 * {@link uniformPdfValidated} checks that `high > low`. The schema alone does
 * not establish that invariant.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformDistParams = Schema.Struct({
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformDistParams" })

/**
 * Accepts positive finite beta shape parameters.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaDistParams = Schema.Struct({
  alpha: PositiveFiniteNumber,
  beta: PositiveFiniteNumber
}).annotations({ identifier: "BetaDistParams" })

/**
 * Accepts positive finite gamma shape and scale parameters.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaDistParams = Schema.Struct({
  shape: PositiveFiniteNumber,
  scale: PositiveFiniteNumber
}).annotations({ identifier: "GammaDistParams" })

/**
 * Accepts positive finite degrees of freedom for a Student's t distribution.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTDistParams = Schema.Struct({
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTDistParams" })

/**
 * Accepts a non-empty array of non-negative finite categorical masses.
 *
 * @remarks
 * Decoding does not require the masses to sum to `1`, and current operations
 * do not normalize or validate that sum.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistParams = Schema.Struct({
  probs: Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
}).annotations({ identifier: "CategoricalDistParams" })

/**
 * Accepts a non-negative integer trial count and a unit-interval success probability.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BinomialDistParams = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  p: UnitIntervalNumber
}).annotations({ identifier: "BinomialDistParams" })

/**
 * Accepts a positive finite Poisson rate.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PoissonDistParams = Schema.Struct({
  mu: PositiveFiniteNumber
}).annotations({ identifier: "PoissonDistParams" })

// ---------------------------------------------------------------------------
// Continuous eval input schemas (for pdf/cdf/logpdf)
// ---------------------------------------------------------------------------

/**
 * Accepts a finite evaluation point and location with a positive finite normal scale.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalDistEvalInput = Schema.Struct({
  x: FiniteNumber,
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalDistEvalInput" })

/**
 * Accepts a positive finite evaluation point, finite log-space location, and positive scale.
 *
 * @remarks
 * This boundary excludes the zero and negative points that pure log-normal
 * operations map to support sentinels.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogNormalDistEvalInput = Schema.Struct({
  x: PositiveFiniteNumber,
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "LogNormalDistEvalInput" })

/**
 * Accepts a non-negative finite point and a positive finite exponential rate.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialDistEvalInput = Schema.Struct({
  x: NonNegativeFiniteNumber,
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialDistEvalInput" })

/**
 * Accepts a finite evaluation point and finite uniform bounds in either order.
 *
 * @remarks
 * {@link uniformPdfValidated} rejects unordered bounds after decoding.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformDistEvalInput = Schema.Struct({
  x: FiniteNumber,
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformDistEvalInput" })

/**
 * Accepts a unit-interval point and positive finite beta shape parameters.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaDistEvalInput = Schema.Struct({
  x: UnitIntervalNumber,
  alpha: PositiveFiniteNumber,
  beta: PositiveFiniteNumber
}).annotations({ identifier: "BetaDistEvalInput" })

/**
 * Accepts a non-negative finite point with positive finite gamma shape and scale.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaDistEvalInput = Schema.Struct({
  x: NonNegativeFiniteNumber,
  shape: PositiveFiniteNumber,
  scale: PositiveFiniteNumber
}).annotations({ identifier: "GammaDistEvalInput" })

/**
 * Accepts a finite point and positive finite Student's t degrees of freedom.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTDistEvalInput = Schema.Struct({
  x: FiniteNumber,
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTDistEvalInput" })

// ---------------------------------------------------------------------------
// Discrete eval input schemas
// ---------------------------------------------------------------------------

/**
 * Accepts a non-negative integer index and non-empty, non-negative finite masses.
 *
 * @remarks
 * The index may exceed the final category. The masses need not sum to `1`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistEvalInput = Schema.Struct({
  k: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  probs: Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
}).annotations({ identifier: "CategoricalDistEvalInput" })

/**
 * Accepts non-negative integer counts and a unit-interval binomial probability.
 *
 * @remarks
 * The success count may exceed the trial count. Binomial mass operations then
 * return `0`, while the cumulative operation returns `1`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BinomialDistEvalInput = Schema.Struct({
  k: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  p: UnitIntervalNumber
}).annotations({ identifier: "BinomialDistEvalInput" })

/**
 * Accepts a non-negative integer count and a positive finite Poisson rate.
 *
 * @remarks
 * Pure Poisson operations define zero-rate behavior, but this boundary
 * requires the rate to be positive.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PoissonDistEvalInput = Schema.Struct({
  k: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  mu: PositiveFiniteNumber
}).annotations({ identifier: "PoissonDistEvalInput" })

// ---------------------------------------------------------------------------
// Quantile input schemas (continuous distributions)
// ---------------------------------------------------------------------------

/**
 * Accepts a probability on `[0, 1]`, finite location, and positive scale for a normal quantile.
 *
 * @remarks
 * Endpoint probabilities are accepted and produce infinite quantiles.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalQuantileInput" })

/**
 * Accepts a probability on `[0, 1]` with finite log-space location and positive scale.
 *
 * @remarks
 * Endpoint probabilities are accepted and produce `0` or positive infinity.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogNormalQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "LogNormalQuantileInput" })

/**
 * Accepts a unit-interval probability and positive finite rate for exponential quantiles.
 *
 * @remarks
 * Probability `1` is accepted and produces positive infinity.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialQuantileInput" })

/**
 * Accepts a unit-interval probability and finite uniform bounds in either order.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformQuantileInput" })

/**
 * Accepts a unit-interval probability and positive finite beta shapes.
 *
 * @remarks
 * Endpoint probabilities are accepted, but the quantile implementation clamps
 * its estimate inside the open unit interval.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  alpha: PositiveFiniteNumber,
  beta: PositiveFiniteNumber
}).annotations({ identifier: "BetaQuantileInput" })

/**
 * Accepts a unit-interval probability and positive finite gamma shape and scale.
 *
 * @remarks
 * The quantile implementation lower-bounds its estimate at `1e-15`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  shape: PositiveFiniteNumber,
  scale: PositiveFiniteNumber
}).annotations({ identifier: "GammaQuantileInput" })

/**
 * Accepts a unit-interval probability and positive finite Student's t degrees of freedom.
 *
 * @remarks
 * Endpoint probabilities are accepted even though iterative evaluation may
 * produce `NaN` from the infinite initial estimate.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTQuantileInput" })
