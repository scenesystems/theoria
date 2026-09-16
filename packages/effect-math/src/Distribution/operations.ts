/**
 * Evaluates continuous and discrete probability distributions.
 *
 * @remarks
 * Pure operations accept trusted numeric inputs and do not check distribution
 * parameters. Validated operations decode unknown input, reject excess fields,
 * and report parse failures as {@link DistributionDecodeError}. Policy-aware
 * operations use the configured precision policy to reject non-finite results
 * and the diagnostics policy to emit an annotated debug log.
 *
 * @since 0.1.0
 * @category operations
 */
import { Array, Chunk, Effect, Number, Schema } from "effect"

import { withScalarPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { DistributionDecodeError, DistributionDomainViolationError, DistributionParameterError } from "./errors.js"
import * as Beta from "./internal/beta.js"
import * as Binomial from "./internal/binomial.js"
import * as Categorical from "./internal/categorical.js"
import * as Exponential from "./internal/exponential.js"
import * as Gamma from "./internal/gamma.js"
import * as LogNormal from "./internal/logNormal.js"
import * as Normal from "./internal/normal.js"
import * as Poisson from "./internal/poisson.js"
import * as StudentT from "./internal/studentT.js"
import * as Uniform from "./internal/uniform.js"
import { DistributionDomainModel } from "./model.js"
import {
  BetaDistEvalInput,
  BetaQuantileInput,
  CategoricalDistEvalInput,
  NormalDistEvalInput,
  NormalQuantileInput,
  UniformDistEvalInput
} from "./schema.js"

const encodeNumber = Schema.encodeSync(Schema.NumberFromString)

/**
 * Returns the canonical provisional distribution-family descriptor for
 * registration or startup discovery, without service requirements or a
 * failure channel.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadDistributionDomain = Effect.succeed(DistributionDomainModel)

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Normal
// ---------------------------------------------------------------------------

/**
 * Evaluates the density of a normal distribution with trusted parameters.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdf: (x: number, mu: number, sigma: number) => number = Normal.normalPdf

/**
 * Evaluates the natural logarithm of a normal density.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalLogpdf: (x: number, mu: number, sigma: number) => number = Normal.normalLogpdf

/**
 * Evaluates the probability of a normal variate being at or below `x`.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdf: (x: number, mu: number, sigma: number) => number = Normal.normalCdf

/**
 * Finds the normal variate whose cumulative probability is `p`.
 *
 * @remarks
 * Probabilities `0` and `1` return negative and positive infinity,
 * respectively. Values outside the unit interval produce `NaN`.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalQuantile: (p: number, mu: number, sigma: number) => number = Normal.normalQuantile

/**
 * Returns the location parameter of a normal distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalMean: (mu: number, sigma: number) => number = Normal.normalMean

/**
 * Returns the square of the normal distribution's scale parameter.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalVariance: (mu: number, sigma: number) => number = Normal.normalVariance

/**
 * Computes normal differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalEntropy: (mu: number, sigma: number) => number = Normal.normalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: LogNormal
// ---------------------------------------------------------------------------

/**
 * Evaluates a log-normal density, returning `0` when `x` is not positive.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalPdf: (x: number, mu: number, sigma: number) => number = LogNormal.logNormalPdf

/**
 * Evaluates the natural logarithm of a log-normal density.
 *
 * @returns Negative infinity when `x` is zero or negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalLogpdf: (x: number, mu: number, sigma: number) => number = LogNormal.logNormalLogpdf

/**
 * Evaluates the cumulative probability of a log-normal variate.
 *
 * @returns `0` when `x` is zero or negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalCdf: (x: number, mu: number, sigma: number) => number = LogNormal.logNormalCdf

/**
 * Finds the log-normal variate whose cumulative probability is `p`.
 *
 * @remarks
 * Probabilities `0` and `1` return `0` and positive infinity, respectively.
 * Values outside the unit interval produce `NaN`.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalQuantile: (p: number, mu: number, sigma: number) => number = LogNormal.logNormalQuantile

/**
 * Computes the arithmetic mean from log-space location and scale.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalMean: (mu: number, sigma: number) => number = LogNormal.logNormalMean

/**
 * Computes variance from log-space location and scale.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalVariance: (mu: number, sigma: number) => number = LogNormal.logNormalVariance

/**
 * Computes log-normal differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const logNormalEntropy: (mu: number, sigma: number) => number = LogNormal.logNormalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Exponential
// ---------------------------------------------------------------------------

/**
 * Evaluates an exponential density, returning `0` when `x` is negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialPdf: (x: number, rate: number) => number = Exponential.exponentialPdf

/**
 * Evaluates the natural logarithm of an exponential density.
 *
 * @returns Negative infinity when `x` is negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialLogpdf: (x: number, rate: number) => number = Exponential.exponentialLogpdf

/**
 * Evaluates cumulative exponential probability, returning `0` when `x` is negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialCdf: (x: number, rate: number) => number = Exponential.exponentialCdf

/**
 * Finds the exponential variate whose cumulative probability is `p`.
 *
 * @returns Positive infinity when `p` is `1`.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialQuantile: (p: number, rate: number) => number = Exponential.exponentialQuantile

/**
 * Returns the reciprocal of the exponential rate.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialMean: (rate: number) => number = Exponential.exponentialMean

/**
 * Returns the reciprocal of the squared exponential rate.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialVariance: (rate: number) => number = Exponential.exponentialVariance

/**
 * Computes exponential differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const exponentialEntropy: (rate: number) => number = Exponential.exponentialEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Uniform
// ---------------------------------------------------------------------------

/**
 * Evaluates uniform density on the closed interval from `low` through `high`.
 *
 * @remarks
 * Returns `0` outside the interval. The bounds are assumed to be ordered.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdf: (x: number, low: number, high: number) => number = Uniform.uniformPdf

/**
 * Evaluates the natural logarithm of uniform density on the closed interval.
 *
 * @returns Negative infinity outside the interval.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformLogpdf: (x: number, low: number, high: number) => number = Uniform.uniformLogpdf

/**
 * Evaluates cumulative uniform probability, clamped to the unit interval.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformCdf: (x: number, low: number, high: number) => number = Uniform.uniformCdf

/**
 * Interpolates linearly between the uniform bounds at probability `p`.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformQuantile: (p: number, low: number, high: number) => number = Uniform.uniformQuantile

/**
 * Returns the midpoint of the uniform bounds.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformMean: (low: number, high: number) => number = Uniform.uniformMean

/**
 * Computes variance from the width between the uniform bounds.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformVariance: (low: number, high: number) => number = Uniform.uniformVariance

/**
 * Computes uniform differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformEntropy: (low: number, high: number) => number = Uniform.uniformEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Beta
// ---------------------------------------------------------------------------

/**
 * Evaluates a beta density for trusted positive shape parameters.
 *
 * @remarks
 * Values outside the open unit interval return `0`. At either endpoint the
 * implementation returns the finite boundary density only when the
 * corresponding shape parameter equals `1`.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaPdf: (x: number, alpha: number, beta: number) => number = Beta.betaPdf

/**
 * Evaluates the natural logarithm of a beta density.
 *
 * @returns Negative infinity outside the open unit interval, including both endpoints.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaLogpdf: (x: number, alpha: number, beta: number) => number = Beta.betaLogpdf

/**
 * Evaluates cumulative beta probability through the regularized incomplete beta function.
 *
 * @returns `0` at or below `0` and `1` at or above `1`.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdf: (x: number, alpha: number, beta: number) => number = Beta.betaCdf

/**
 * Approximates a beta quantile with at most 20 Newton iterations.
 *
 * @remarks
 * Iteration starts at `0.5` and clamps each estimate to
 * `[1e-15, 1 - 1e-15]`. It stops when the CDF error is below `1e-12` or
 * the density is below `1e-30`, and returns the last estimate.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaQuantile: (p: number, alpha: number, beta: number) => number = Beta.betaQuantile

/**
 * Computes the mean of a beta distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaMean: (alpha: number, beta: number) => number = Beta.betaMean

/**
 * Computes the variance of a beta distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaVariance: (alpha: number, beta: number) => number = Beta.betaVariance

/**
 * Computes beta differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaEntropy: (alpha: number, beta: number) => number = Beta.betaEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Gamma
// ---------------------------------------------------------------------------

/**
 * Evaluates a gamma density for trusted positive shape and scale parameters.
 *
 * @remarks
 * Negative `x` values return `0`. At `x = 0`, the implementation returns
 * `1 / scale` when `shape` is `1` and `0` for every other shape.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaPdf: (x: number, shape: number, scale: number) => number = Gamma.gammaPdf

/**
 * Evaluates the natural logarithm of a gamma density.
 *
 * @returns Negative infinity when `x` is zero or negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaLogpdf: (x: number, shape: number, scale: number) => number = Gamma.gammaLogpdf

/**
 * Evaluates cumulative gamma probability through the regularized incomplete gamma function.
 *
 * @returns `0` when `x` is zero or negative.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaCdf: (x: number, shape: number, scale: number) => number = Gamma.gammaCdf

/**
 * Approximates a gamma quantile with at most 50 Newton iterations.
 *
 * @remarks
 * The estimate is lower-bounded by `1e-15`. Iteration stops when the CDF
 * error is below `1e-12` or the density is below `1e-30`, and returns the
 * last estimate.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaQuantile: (p: number, shape: number, scale: number) => number = Gamma.gammaQuantile

/**
 * Computes the mean of a shape-scale gamma distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaMean: (shape: number, scale: number) => number = Gamma.gammaMean

/**
 * Computes the variance of a shape-scale gamma distribution.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaVariance: (shape: number, scale: number) => number = Gamma.gammaVariance

/**
 * Computes gamma differential entropy in nats.
 *
 * @since 0.1.0
 * @category operations
 */
export const gammaEntropy: (shape: number, scale: number) => number = Gamma.gammaEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: StudentT
// ---------------------------------------------------------------------------

/**
 * Evaluates a Student's t density for trusted positive degrees of freedom.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTPdf: (x: number, df: number) => number = StudentT.studentTPdf

/**
 * Evaluates the natural logarithm of a Student's t density.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTLogpdf: (x: number, df: number) => number = StudentT.studentTLogpdf

/**
 * Evaluates cumulative Student's t probability through the regularized incomplete beta function.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTCdf: (x: number, df: number) => number = StudentT.studentTCdf

/**
 * Approximates a Student's t quantile with at most 50 Newton iterations.
 *
 * @remarks
 * Iteration starts from a standard-normal quantile and stops when the CDF
 * error is below `1e-12` or the density is below `1e-30`. Endpoint
 * probabilities begin with an infinite estimate and may produce `NaN`.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTQuantile: (p: number, df: number) => number = StudentT.studentTQuantile

/**
 * Returns `0` when the Student's t mean exists and `NaN` when `df <= 1`.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTMean: (df: number) => number = StudentT.studentTMean

/**
 * Computes Student's t variance when it exists.
 *
 * @returns `df / (df - 2)` when `df > 2`, positive infinity when
 * `1 < df <= 2`, and `NaN` when `df <= 1`.
 *
 * @since 0.1.0
 * @category operations
 */
export const studentTVariance: (df: number) => number = StudentT.studentTVariance

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Categorical
// ---------------------------------------------------------------------------

/**
 * Reads the mass assigned to category index `k`.
 *
 * @returns `0` when `k` is outside the `Chunk`.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalPmf: (k: number, probs: Chunk.Chunk<number>) => number = Categorical.categoricalPmf

/**
 * Returns the natural logarithm of the mass at category index `k`.
 *
 * @returns Negative infinity when `k` is outside the `Chunk` or its mass is zero.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalLogpmf: (k: number, probs: Chunk.Chunk<number>) => number = Categorical.categoricalLogpmf

/**
 * Sums categorical masses through index `k`.
 *
 * @remarks
 * Returns `0` for negative indices and `1` at or beyond the final index.
 * The latter result does not depend on the actual sum of `probs`; callers
 * must supply normalized probabilities when they need distribution semantics.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalCdf: (k: number, probs: Chunk.Chunk<number>) => number = Categorical.categoricalCdf

/**
 * Computes the probability-weighted category index.
 *
 * @remarks
 * The input is used as given and is not normalized.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalMean: (probs: Chunk.Chunk<number>) => number = Categorical.categoricalMean

/**
 * Computes variance of category indices using the supplied masses.
 *
 * @remarks
 * The input is used as given and is not normalized.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalVariance: (probs: Chunk.Chunk<number>) => number = Categorical.categoricalVariance

/**
 * Computes categorical entropy in nats using the supplied masses.
 *
 * @remarks
 * Zero masses contribute `0`. The input is not normalized or checked for
 * negative values.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalEntropy: (probs: Chunk.Chunk<number>) => number = Categorical.categoricalEntropy

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Binomial
// ---------------------------------------------------------------------------

/**
 * Evaluates binomial mass at an integer success count.
 *
 * @returns `0` when `k` is non-integral, negative, or greater than `n`.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialPmf: (k: number, n: number, p: number) => number = Binomial.binomialPmf

/**
 * Evaluates the natural logarithm of binomial mass.
 *
 * @returns Negative infinity when `k` is non-integral or outside `[0, n]`.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialLogpmf: (k: number, n: number, p: number) => number = Binomial.binomialLogpmf

/**
 * Evaluates cumulative binomial probability through the regularized incomplete beta function.
 *
 * @returns `0` below the support and `1` at or above `n`.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialCdf: (k: number, n: number, p: number) => number = Binomial.binomialCdf

/**
 * Computes the expected success count for `n` trials.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialMean: (n: number, p: number) => number = Binomial.binomialMean

/**
 * Computes success-count variance for `n` trials.
 *
 * @since 0.1.0
 * @category operations
 */
export const binomialVariance: (n: number, p: number) => number = Binomial.binomialVariance

// ---------------------------------------------------------------------------
// Pure kernel re-exports: Poisson
// ---------------------------------------------------------------------------

/**
 * Evaluates Poisson mass at a non-negative integer count.
 *
 * @remarks
 * Returns `0` for negative or non-integral `k`. A zero rate assigns all mass
 * to `k = 0`, although validated rate schemas require a positive value.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonPmf: (k: number, mu: number) => number = Poisson.poissonPmf

/**
 * Evaluates the natural logarithm of Poisson mass.
 *
 * @returns Negative infinity for negative or non-integral `k`, or for a
 * positive count under a zero rate.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonLogpmf: (k: number, mu: number) => number = Poisson.poissonLogpmf

/**
 * Evaluates cumulative Poisson probability through the upper incomplete gamma function.
 *
 * @returns `0` for negative `k`. A zero rate returns `1` for every
 * non-negative `k`.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonCdf: (k: number, mu: number) => number = Poisson.poissonCdf

/**
 * Returns the Poisson rate as the expected count.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonMean: (mu: number) => number = Poisson.poissonMean

/**
 * Returns the Poisson rate as the count variance.
 *
 * @since 0.1.0
 * @category operations
 */
export const poissonVariance: (mu: number) => number = Poisson.poissonVariance

// ---------------------------------------------------------------------------
// Schema-validated operations
// ---------------------------------------------------------------------------

/**
 * Decodes finite normal parameters and evaluates density.
 *
 * @returns The density for a finite `x` and `mu` with positive finite `sigma`.
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalPdf",
          message: error.message
        })
      )
    )

    return Normal.normalPdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Decodes finite normal parameters and evaluates cumulative probability.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalCdf",
          message: error.message
        })
      )
    )

    return Normal.normalCdf(decoded.x, decoded.mu, decoded.sigma)
  })

/**
 * Decodes a unit-interval probability and finite normal parameters before evaluating a quantile.
 *
 * @remarks
 * Endpoint probabilities return infinities after successful decoding.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalQuantileValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(NormalQuantileInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "normalQuantile",
          message: error.message
        })
      )
    )

    return Normal.normalQuantile(decoded.p, decoded.mu, decoded.sigma)
  })

/**
 * Decodes finite uniform inputs and evaluates density after checking bound order.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, non-finite, or excess fields.
 * @throws {@link DistributionParameterError} in the Effect error channel when
 * `low` is greater than or equal to `high`.
 *
 * @since 0.1.0
 * @category operations
 */
export const uniformPdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(UniformDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "uniformPdf",
          message: error.message
        })
      )
    )

    yield* Effect.filterOrFail(
      Effect.succeed(decoded),
      (d) => Number.lessThan(d.low, d.high),
      (d) =>
        new DistributionParameterError({
          operation: "uniformPdf",
          message: Array.join(
            Array.make(
              "Uniform distribution requires low < high, got low=",
              encodeNumber(d.low),
              ", high=",
              encodeNumber(d.high)
            ),
            ""
          )
        })
    )

    return Uniform.uniformPdf(decoded.x, decoded.low, decoded.high)
  })

/**
 * Decodes positive beta shapes and a unit-interval point before evaluating cumulative probability.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "betaCdf",
          message: error.message
        })
      )
    )

    return Beta.betaCdf(decoded.x, decoded.alpha, decoded.beta)
  })

/**
 * Decodes positive beta shapes and a unit-interval probability before approximating a quantile.
 *
 * @remarks
 * The result uses the same clamped, finite-iteration procedure as {@link betaQuantile}.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaQuantileValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(BetaQuantileInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "betaQuantile",
          message: error.message
        })
      )
    )

    return Beta.betaQuantile(decoded.p, decoded.alpha, decoded.beta)
  })

/**
 * Decodes a non-negative category index and a non-empty array of non-negative masses.
 *
 * @remarks
 * The masses are not normalized and are not required to sum to `1`. An index
 * beyond the final category decodes successfully and returns `0`.
 *
 * @throws {@link DistributionDecodeError} in the Effect error channel when
 * the input has missing, invalid, or excess fields.
 *
 * @since 0.1.0
 * @category operations
 */
export const categoricalPmfValidated = (input: unknown) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknown(CategoricalDistEvalInput)(input, {
      onExcessProperty: "error"
    }).pipe(
      Effect.mapError((error) =>
        new DistributionDecodeError({
          operation: "categoricalPmf",
          message: error.message
        })
      )
    )

    return Categorical.categoricalPmf(decoded.k, Chunk.fromIterable(decoded.probs))
  })

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

/**
 * Evaluates normal density under the configured precision and diagnostics policies.
 *
 * @remarks
 * Strict precision fails on a non-finite result but does not validate the
 * inputs independently. Enabled diagnostics emit one debug log containing
 * the inputs, result, precision mode, and elapsed milliseconds.
 *
 * @throws {@link DistributionDomainViolationError} in the Effect error
 * channel when strict precision rejects the result.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalPdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.normalPdfWithPolicies",
    compute: () => Normal.normalPdf(x, mu, sigma),
    makeError: (message) => new DistributionDomainViolationError({ operation: "normalPdfWithPolicies", message }),
    annotations: (result) => ({
      x: encodeNumber(x),
      mu: encodeNumber(mu),
      sigma: encodeNumber(sigma),
      result: encodeNumber(result)
    })
  })

/**
 * Evaluates cumulative normal probability under the configured runtime policies.
 *
 * @remarks
 * Input parameters are not validated. Strict precision rejects a non-finite
 * result; enabled diagnostics emit one annotated debug log.
 *
 * @throws {@link DistributionDomainViolationError} in the Effect error
 * channel when strict precision rejects the result.
 *
 * @since 0.1.0
 * @category operations
 */
export const normalCdfWithPolicies = (x: number, mu: number, sigma: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.normalCdfWithPolicies",
    compute: () => Normal.normalCdf(x, mu, sigma),
    makeError: (message) => new DistributionDomainViolationError({ operation: "normalCdfWithPolicies", message }),
    annotations: (result) => ({
      x: encodeNumber(x),
      mu: encodeNumber(mu),
      sigma: encodeNumber(sigma),
      result: encodeNumber(result)
    })
  })

/**
 * Evaluates cumulative beta probability under the configured runtime policies.
 *
 * @remarks
 * Input parameters are not validated. Strict precision rejects a non-finite
 * result; enabled diagnostics emit one annotated debug log.
 *
 * @throws {@link DistributionDomainViolationError} in the Effect error
 * channel when strict precision rejects the result.
 *
 * @since 0.1.0
 * @category operations
 */
export const betaCdfWithPolicies = (x: number, alpha: number, beta: number) =>
  withScalarPolicyGuards({
    operation: "Distribution.betaCdfWithPolicies",
    compute: () => Beta.betaCdf(x, alpha, beta),
    makeError: (message) => new DistributionDomainViolationError({ operation: "betaCdfWithPolicies", message }),
    annotations: (result) => ({
      x: encodeNumber(x),
      alpha: encodeNumber(alpha),
      beta: encodeNumber(beta),
      result: encodeNumber(result)
    })
  })
