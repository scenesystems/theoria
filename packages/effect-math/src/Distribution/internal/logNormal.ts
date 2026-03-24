/**
 * Log-normal distribution kernels.
 * Parameters: mu (log-space mean), sigma (log-space stddev).
 * X ~ LogNormal(mu, sigma) iff ln(X) ~ Normal(mu, sigma).
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
 * Precomputed √(2π) for the log-normal PDF denominator.
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
 * Log-normal PDF: f(x; μ, σ) = (1 / (xσ√(2π))) · exp(−½((ln x − μ) / σ)²)
 * for x > 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalPdf = (x: number, mu: number, sigma: number): number =>
  N.greaterThan(x, 0)
    ? (() => {
      const lnx = Math.log(x)
      const z = N.unsafeDivide(N.subtract(lnx, mu), sigma)
      return N.multiply(
        N.unsafeDivide(1, N.multiply(x, N.multiply(sigma, SQRT_2PI))),
        Math.exp(N.multiply(-0.5, N.multiply(z, z)))
      )
    })()
    : 0

/**
 * Log-normal log-PDF: ln f(x; μ, σ) = −ln(x) − ln(σ) − 0.5·ln(2π) − 0.5·((ln x − μ) / σ)²
 * for x > 0, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalLogpdf = (x: number, mu: number, sigma: number): number =>
  N.greaterThan(x, 0)
    ? (() => {
      const lnx = Math.log(x)
      const z = N.unsafeDivide(N.subtract(lnx, mu), sigma)
      return N.subtract(
        N.subtract(
          N.subtract(N.negate(lnx), Math.log(sigma)),
          LOG_SQRT_2PI
        ),
        N.multiply(0.5, N.multiply(z, z))
      )
    })()
    : -Infinity

/**
 * Log-normal CDF: F(x; μ, σ) = ½(1 + erf((ln x − μ) / (σ√2)))
 * for x > 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalCdf = (x: number, mu: number, sigma: number): number =>
  N.greaterThan(x, 0)
    ? N.multiply(
      0.5,
      N.sum(
        1,
        erfAbramowitzStegun(
          N.unsafeDivide(N.subtract(Math.log(x), mu), N.multiply(sigma, Math.SQRT2))
        )
      )
    )
    : 0

/**
 * Log-normal quantile (inverse CDF): Q(p; μ, σ) = exp(μ + σ√2 · erfinv(2p − 1)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalQuantile = (p: number, mu: number, sigma: number): number =>
  Math.exp(
    N.sum(
      mu,
      N.multiply(
        N.multiply(sigma, Math.SQRT2),
        erfinvKernel(N.subtract(N.multiply(2, p), 1))
      )
    )
  )

/**
 * Log-normal mean: E[X] = exp(μ + σ² / 2).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalMean = (mu: number, sigma: number): number =>
  Math.exp(N.sum(mu, N.multiply(0.5, N.multiply(sigma, sigma))))

/**
 * Log-normal variance: Var(X) = (exp(σ²) − 1) · exp(2μ + σ²).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalVariance = (mu: number, sigma: number): number => {
  const sigma2 = N.multiply(sigma, sigma)
  return N.multiply(
    N.subtract(Math.exp(sigma2), 1),
    Math.exp(N.sum(N.multiply(2, mu), sigma2))
  )
}

/**
 * Log-normal differential entropy: H(X) = μ + 0.5 + 0.5·ln(2π) + ln(σ).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalEntropy = (mu: number, sigma: number): number => N.sum(mu, N.sum(HALF_LOG_2PI_E, Math.log(sigma)))
