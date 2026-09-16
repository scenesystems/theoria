/**
 * Log-normal distribution kernels.
 * Parameters: mu (log-space mean), sigma (log-space stddev).
 * X ~ LogNormal(mu, sigma) iff ln(X) ~ Normal(mu, sigma).
 *
 * CDF and quantile delegate to canonical public Special operations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number } from "effect"

import { exp, log, pi, sqrt } from "../../Numeric/index.js"
import { erf, erfinv } from "../../Special/index.js"

/**
 * Precomputed √(2π) for the log-normal PDF denominator.
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
 * Log-normal PDF: f(x; μ, σ) = (1 / (xσ√(2π))) · exp(−½((ln x − μ) / σ)²)
 * for x > 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalPdf = (x: number, mu: number, sigma: number): number =>
  Boolean.match(Number.greaterThan(x, 0), {
    onTrue: () => {
      const lnx = log(x)
      const z = Number.unsafeDivide(Number.subtract(lnx, mu), sigma)
      return Number.multiply(
        Number.unsafeDivide(1, Number.multiply(x, Number.multiply(sigma, SQRT_2PI))),
        exp(Number.multiply(-0.5, Number.multiply(z, z)))
      )
    },
    onFalse: () => 0
  })

/**
 * Log-normal log-PDF: ln f(x; μ, σ) = −ln(x) − ln(σ) − 0.5·ln(2π) − 0.5·((ln x − μ) / σ)²
 * for x > 0, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalLogpdf = (x: number, mu: number, sigma: number): number =>
  Boolean.match(Number.greaterThan(x, 0), {
    onTrue: () => {
      const lnx = log(x)
      const z = Number.unsafeDivide(Number.subtract(lnx, mu), sigma)
      return Number.subtract(
        Number.subtract(
          Number.subtract(Number.negate(lnx), log(sigma)),
          LOG_SQRT_2PI
        ),
        Number.multiply(0.5, Number.multiply(z, z))
      )
    },
    onFalse: () => -Infinity
  })

/**
 * Log-normal CDF: F(x; μ, σ) = ½(1 + erf((ln x − μ) / (σ√2)))
 * for x > 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalCdf = (x: number, mu: number, sigma: number): number =>
  Boolean.match(Number.greaterThan(x, 0), {
    onTrue: () =>
      Number.multiply(
        0.5,
        Number.sum(
          1,
          erf(
            Number.unsafeDivide(Number.subtract(log(x), mu), Number.multiply(sigma, SQRT_2))
          )
        )
      ),
    onFalse: () => 0
  })

/**
 * Log-normal quantile (inverse CDF): Q(p; μ, σ) = exp(μ + σ√2 · erfinv(2p − 1)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalQuantile = (p: number, mu: number, sigma: number): number =>
  exp(
    Number.sum(
      mu,
      Number.multiply(
        Number.multiply(sigma, SQRT_2),
        erfinv(Number.subtract(Number.multiply(2, p), 1))
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
  exp(Number.sum(mu, Number.multiply(0.5, Number.multiply(sigma, sigma))))

/**
 * Log-normal variance: Var(X) = (exp(σ²) − 1) · exp(2μ + σ²).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalVariance = (mu: number, sigma: number): number => {
  const sigma2 = Number.multiply(sigma, sigma)
  return Number.multiply(
    Number.subtract(exp(sigma2), 1),
    exp(Number.sum(Number.multiply(2, mu), sigma2))
  )
}

/**
 * Log-normal differential entropy: H(X) = μ + 0.5 + 0.5·ln(2π) + ln(σ).
 *
 * @since 0.1.0
 * @category internal
 */
export const logNormalEntropy = (mu: number, sigma: number): number =>
  Number.sum(mu, Number.sum(HALF_LOG_2PI_E, log(sigma)))
