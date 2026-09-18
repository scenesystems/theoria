/**
 * Normal (Gaussian) distribution kernels.
 * Full algebra: pdf, logpdf, cdf, quantile, mean, variance, entropy.
 *
 * CDF and quantile delegate to canonical public Special operations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number } from "effect"

import { exp, log, pi, sqrt } from "../../Numeric.js"
import { erfc, erfcinv } from "../../Special.js"

/**
 * Precomputed √(2π) for the normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const sqrtTwo = sqrt(2)
const normalizationDenominator = sqrt(Number.multiply(2, pi))

/**
 * Precomputed 0.5 · ln(2π) for logpdf.
 *
 * @since 0.1.0
 * @category internal
 */
const logNormalization = Number.multiply(0.5, log(Number.multiply(2, pi)))

/**
 * Precomputed 0.5 + 0.5 · ln(2π) for entropy.
 *
 * @since 0.1.0
 * @category internal
 */
const entropyOffset = Number.sum(0.5, logNormalization)
const unitIntervalEpsilon = 1e-12

const clampUnitRoll = (roll: number): number =>
  Number.clamp(roll, {
    minimum: unitIntervalEpsilon,
    maximum: Number.subtract(1, unitIntervalEpsilon)
  })

/**
 * Standard normal PDF: φ(x) = exp(−x²/2) / √(2π).
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalPdf = (x: number): number =>
  Number.multiply(
    Number.unsafeDivide(1, normalizationDenominator),
    exp(Number.multiply(-0.5, Number.multiply(x, x)))
  )

/**
 * Standard normal CDF: Φ(x) = ½ erfc(−x / √2), preserving the lower tail.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalCdf = (x: number): number =>
  Number.multiply(0.5, erfc(Number.unsafeDivide(Number.negate(x), sqrtTwo)))

/**
 * Finite standard-normal inverse transform with deterministic endpoint clamping.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalTransform = (roll: number): number => normalQuantile(clampUnitRoll(roll), 0, 1)

/**
 * Normal PDF: φ(x; μ, σ) = (1 / (σ√(2π))) · exp(−½((x − μ) / σ)²).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = Number.unsafeDivide(Number.subtract(x, mu), sigma)
  return Number.unsafeDivide(standardNormalPdf(z), sigma)
}

/**
 * Normal log-PDF: ln φ(x; μ, σ) = −0.5·ln(2π) − ln(σ) − 0.5·((x − μ) / σ)².
 *
 * @since 0.1.0
 * @category internal
 */
export const normalLogpdf = (x: number, mu: number, sigma: number): number => {
  const z = Number.unsafeDivide(Number.subtract(x, mu), sigma)
  return Number.subtract(
    Number.subtract(Number.negate(logNormalization), log(sigma)),
    Number.multiply(0.5, Number.multiply(z, z))
  )
}

/**
 * Normal CDF: Φ(x; μ, σ) = ½(1 + erf((x − μ) / (σ√2))).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalCdf = (x: number, mu: number, sigma: number): number =>
  standardNormalCdf(Number.unsafeDivide(Number.subtract(x, mu), sigma))

/**
 * Normal quantile (inverse CDF): Q(p; μ, σ) = μ − σ√2 · erfcinv(2p).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalQuantile = (p: number, mu: number, sigma: number): number =>
  Number.subtract(
    mu,
    Number.multiply(
      Number.multiply(sigma, sqrtTwo),
      erfcinv(Number.multiply(2, p))
    )
  )

/**
 * Normal mean: E[X] = μ.
 *
 * @since 0.1.0
 * @category internal
 */
export const normalMean = (mu: number, _sigma: number): number => mu

/**
 * Normal variance: Var(X) = σ².
 *
 * @since 0.1.0
 * @category internal
 */
export const normalVariance = (_mu: number, sigma: number): number => Number.multiply(sigma, sigma)

/**
 * Normal differential entropy: H(X) = 0.5 + 0.5·ln(2π) + ln(σ).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalEntropy = (_mu: number, sigma: number): number => Number.sum(entropyOffset, log(sigma))
