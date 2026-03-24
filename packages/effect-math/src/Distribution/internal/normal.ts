/**
 * Normal (Gaussian) distribution kernels.
 * Full algebra: pdf, logpdf, cdf, quantile, mean, variance, entropy.
 *
 * CDF delegates to erf from Special/internal/erf.js.
 * Quantile delegates to erfinv from Special/internal/erfinv.js.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { erfAbramowitzStegun } from "../../Special/internal/erf.js"
import { erfinvKernel } from "../../Special/internal/erfinv.js"

/**
 * Precomputed √(2π) for the normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const SQRT_2PI = Math.sqrt(N.multiply(2, Math.PI))

/**
 * Precomputed 0.5 · ln(2π) for logpdf.
 *
 * @since 0.1.0
 * @category internal
 */
const LOG_SQRT_2PI = N.multiply(0.5, Math.log(N.multiply(2, Math.PI)))

/**
 * Precomputed 0.5 + 0.5 · ln(2π) for entropy.
 *
 * @since 0.1.0
 * @category internal
 */
const HALF_LOG_2PI_E = N.sum(0.5, N.multiply(0.5, Math.log(N.multiply(2, Math.PI))))

/**
 * Normal PDF: φ(x; μ, σ) = (1 / (σ√(2π))) · exp(−½((x − μ) / σ)²).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = N.unsafeDivide(N.subtract(x, mu), sigma)
  return N.multiply(
    N.unsafeDivide(1, N.multiply(sigma, SQRT_2PI)),
    Math.exp(N.multiply(-0.5, N.multiply(z, z)))
  )
}

/**
 * Normal log-PDF: ln φ(x; μ, σ) = −0.5·ln(2π) − ln(σ) − 0.5·((x − μ) / σ)².
 *
 * @since 0.1.0
 * @category internal
 */
export const normalLogpdf = (x: number, mu: number, sigma: number): number => {
  const z = N.unsafeDivide(N.subtract(x, mu), sigma)
  return N.subtract(
    N.subtract(N.negate(LOG_SQRT_2PI), Math.log(sigma)),
    N.multiply(0.5, N.multiply(z, z))
  )
}

/**
 * Normal CDF: Φ(x; μ, σ) = ½(1 + erf((x − μ) / (σ√2))).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalCdf = (x: number, mu: number, sigma: number): number =>
  N.multiply(
    0.5,
    N.sum(
      1,
      erfAbramowitzStegun(
        N.unsafeDivide(N.subtract(x, mu), N.multiply(sigma, Math.SQRT2))
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
  N.sum(
    mu,
    N.multiply(
      N.multiply(sigma, Math.SQRT2),
      erfinvKernel(N.subtract(N.multiply(2, p), 1))
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
export const normalVariance = (_mu: number, sigma: number): number => N.multiply(sigma, sigma)

/**
 * Normal differential entropy: H(X) = 0.5 + 0.5·ln(2π) + ln(σ).
 *
 * @since 0.1.0
 * @category internal
 */
export const normalEntropy = (_mu: number, sigma: number): number => N.sum(HALF_LOG_2PI_E, Math.log(sigma))
