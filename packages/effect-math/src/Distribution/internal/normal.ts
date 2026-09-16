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

import { exp, log, pi, sqrt } from "../../Numeric/index.js"
import { erf, erfinv } from "../../Special/index.js"

/**
 * Precomputed √(2π) for the normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const SQRT_2 = sqrt(2)
const SQRT_2PI = sqrt(Number.multiply(2, pi))

/**
 * Precomputed 0.5 · ln(2π) for logpdf.
 *
 * @since 0.1.0
 * @category internal
 */
const LOG_SQRT_2PI = Number.multiply(0.5, log(Number.multiply(2, pi)))

/**
 * Precomputed 0.5 + 0.5 · ln(2π) for entropy.
 *
 * @since 0.1.0
 * @category internal
 */
const HALF_LOG_2PI_E = Number.sum(0.5, LOG_SQRT_2PI)

/**
 * Normal PDF: φ(x; μ, σ) = (1 / (σ√(2π))) · exp(−½((x − μ) / σ)²).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = Number.unsafeDivide(Number.subtract(x, mu), sigma)
  return Number.multiply(
    Number.unsafeDivide(1, Number.multiply(sigma, SQRT_2PI)),
    exp(Number.multiply(-0.5, Number.multiply(z, z)))
  )
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
    Number.subtract(Number.negate(LOG_SQRT_2PI), log(sigma)),
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
  Number.multiply(
    0.5,
    Number.sum(
      1,
      erf(
        Number.unsafeDivide(Number.subtract(x, mu), Number.multiply(sigma, SQRT_2))
      )
    )
  )

/**
 * Normal quantile (inverse CDF): Q(p; μ, σ) = μ + σ√2 · erfinv(2p − 1).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalQuantile = (p: number, mu: number, sigma: number): number =>
  Number.sum(
    mu,
    Number.multiply(
      Number.multiply(sigma, SQRT_2),
      erfinv(Number.subtract(Number.multiply(2, p), 1))
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
export const normalEntropy = (_mu: number, sigma: number): number => Number.sum(HALF_LOG_2PI_E, log(sigma))
