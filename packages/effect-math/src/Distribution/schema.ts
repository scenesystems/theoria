/**
 * Schema authority for the Distribution domain — defines the canonical
 * domain discriminator, distribution parameter contracts, eval input
 * schemas, and quantile input schemas. All schemas enforce finite-number
 * validation at decode time, so kernels can assume well-formed numeric input.
 *
 * Covers 11 distribution families: Normal, LogNormal, Exponential, Uniform,
 * Beta, Gamma, StudentT, NoncentralT, Categorical, Binomial, Poisson.
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
 * Canonical domain discriminator for Distribution. Consumers use this to
 * identify which domain produced a result when multiple domains coexist in
 * the same pipeline. The `stability` field tracks the domain's maturity level.
 *
 * @since 0.1.0
 * @category schemas
 */
export const DistributionDomainSchema = Schema.Struct({
  domain: Schema.Literal("Distribution"),
  stability: DomainStability
})

/**
 * Extracted type of a decoded `DistributionDomainSchema` — use this in
 * function signatures that accept an already-validated domain descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type DistributionDomain = typeof DistributionDomainSchema.Type

/**
 * Decodes unknown boundary input into the canonical distribution domain model.
 * Uses strict excess-property checking — any properties beyond `domain` and
 * `stability` cause a `BoundaryDecodeError`. Use at package edges where
 * untrusted input enters the domain.
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
 * Encodes a validated `DistributionDomain` back to its serializable form at
 * the package boundary. Failures surface as `BoundaryEncodeError` — this
 * should only happen if the domain value was constructed outside of Schema.
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
 * Distribution boundary encode/decode errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionSchemaBoundaryError = BoundaryDecodeError | BoundaryEncodeError

// ---------------------------------------------------------------------------
// Shared finite number schemas
// ---------------------------------------------------------------------------

/**
 * A finite number (excludes NaN and ±Infinity).
 *
 * @since 0.1.0
 * @category schemas
 */
export const FiniteNumber = Schema.Number.pipe(Schema.finite())

/**
 * A strictly positive finite number (> 0, excludes NaN and ±Infinity).
 *
 * @since 0.1.0
 * @category schemas
 */
export const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

/**
 * A non-negative finite number (≥ 0, excludes NaN and ±Infinity).
 *
 * @since 0.1.0
 * @category schemas
 */
export const NonNegativeFiniteNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

/**
 * A number in the unit interval [0, 1].
 *
 * @since 0.1.0
 * @category schemas
 */
export const UnitIntervalNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1)
)

/**
 * A number in the open unit interval (0, 1).
 *
 * @since 0.3.0
 * @category schemas
 */
export const OpenUnitIntervalNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThan(0),
  Schema.lessThan(1)
)

// ---------------------------------------------------------------------------
// Distribution parameter schemas
// ---------------------------------------------------------------------------

/**
 * Normal distribution parameters: mean (mu) and standard deviation (sigma).
 * Sigma must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NormalDistParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "NormalDistParams" })

/**
 * Log-normal distribution parameters: location (mu) and scale (sigma).
 * Sigma must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LogNormalDistParams = Schema.Struct({
  mu: FiniteNumber,
  sigma: PositiveFiniteNumber
}).annotations({ identifier: "LogNormalDistParams" })

/**
 * Exponential distribution parameter: rate (λ).
 * Rate must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialDistParams = Schema.Struct({
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialDistParams" })

/**
 * Uniform distribution parameters: lower and upper bounds.
 * Both must be finite. The `high > low` invariant is enforced at the
 * operation level, not at the schema level, to produce domain-specific errors.
 *
 * @since 0.1.0
 * @category schemas
 */
export const UniformDistParams = Schema.Struct({
  low: FiniteNumber,
  high: FiniteNumber
}).annotations({ identifier: "UniformDistParams" })

/**
 * Beta distribution parameters: shape parameters alpha and beta.
 * Both must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BetaDistParams = Schema.Struct({
  alpha: PositiveFiniteNumber,
  beta: PositiveFiniteNumber
}).annotations({ identifier: "BetaDistParams" })

/**
 * Gamma distribution parameters: shape and scale.
 * Both must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GammaDistParams = Schema.Struct({
  shape: PositiveFiniteNumber,
  scale: PositiveFiniteNumber
}).annotations({ identifier: "GammaDistParams" })

/**
 * Student's t-distribution parameter: degrees of freedom (df).
 * Must be strictly positive and finite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTDistParams = Schema.Struct({
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTDistParams" })

/**
 * Noncentral Student's t-distribution parameters: degrees of freedom and
 * noncentrality. Degrees of freedom must be strictly positive and finite.
 *
 * @since 0.3.0
 * @category schemas
 */
export const NoncentralTDistParams = Schema.Struct({
  df: PositiveFiniteNumber,
  noncentrality: FiniteNumber
}).annotations({ identifier: "NoncentralTDistParams" })

/**
 * Categorical distribution parameters: probability vector.
 * A non-empty array of non-negative finite numbers. The sum-to-1
 * invariant is enforced at the operation level.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistParams = Schema.Struct({
  probs: Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
}).annotations({ identifier: "CategoricalDistParams" })

/**
 * Binomial distribution parameters: number of trials (n) and success
 * probability (p). n must be a non-negative integer, p in [0, 1].
 *
 * @since 0.1.0
 * @category schemas
 */
export const BinomialDistParams = Schema.Struct({
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  p: UnitIntervalNumber
}).annotations({ identifier: "BinomialDistParams" })

/**
 * Poisson distribution parameter: mean (mu).
 * Must be strictly positive and finite.
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
 * Point evaluation input for normal distribution PDF/CDF/logPDF.
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
 * Point evaluation input for log-normal distribution PDF/CDF/logPDF.
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
 * Point evaluation input for exponential distribution PDF/CDF/logPDF.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialDistEvalInput = Schema.Struct({
  x: NonNegativeFiniteNumber,
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialDistEvalInput" })

/**
 * Point evaluation input for uniform distribution PDF/CDF/logPDF.
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
 * Point evaluation input for beta distribution PDF/CDF/logPDF.
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
 * Point evaluation input for gamma distribution PDF/CDF/logPDF.
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
 * Point evaluation input for Student's t-distribution PDF/CDF/logPDF.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTDistEvalInput = Schema.Struct({
  x: FiniteNumber,
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTDistEvalInput" })

/**
 * Point evaluation input for the noncentral Student's t-distribution CDF.
 *
 * @since 0.3.0
 * @category schemas
 */
export const NoncentralTDistEvalInput = Schema.Struct({
  x: FiniteNumber,
  df: PositiveFiniteNumber,
  noncentrality: FiniteNumber
}).annotations({ identifier: "NoncentralTDistEvalInput" })

// ---------------------------------------------------------------------------
// Discrete eval input schemas
// ---------------------------------------------------------------------------

/**
 * Point evaluation input for categorical distribution PMF.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CategoricalDistEvalInput = Schema.Struct({
  k: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  probs: Schema.NonEmptyArray(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
}).annotations({ identifier: "CategoricalDistEvalInput" })

/**
 * Point evaluation input for binomial distribution PMF/CDF.
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
 * Point evaluation input for Poisson distribution PMF/CDF.
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
 * Quantile input for normal distribution inverse CDF.
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
 * Quantile input for log-normal distribution inverse CDF.
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
 * Quantile input for exponential distribution inverse CDF.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExponentialQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  rate: PositiveFiniteNumber
}).annotations({ identifier: "ExponentialQuantileInput" })

/**
 * Quantile input for uniform distribution inverse CDF.
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
 * Quantile input for beta distribution inverse CDF.
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
 * Quantile input for gamma distribution inverse CDF.
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
 * Quantile input for Student's t-distribution inverse CDF.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudentTQuantileInput = Schema.Struct({
  p: UnitIntervalNumber,
  df: PositiveFiniteNumber
}).annotations({ identifier: "StudentTQuantileInput" })

/**
 * Quantile input for the noncentral Student's t-distribution inverse CDF.
 *
 * @since 0.3.0
 * @category schemas
 */
export const NoncentralTQuantileInput = Schema.Struct({
  p: OpenUnitIntervalNumber,
  df: PositiveFiniteNumber,
  noncentrality: FiniteNumber
}).annotations({ identifier: "NoncentralTQuantileInput" })
