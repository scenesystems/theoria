/**
 * Exponential distribution kernels.
 * Parameter: rate (λ > 0). Mean = 1/λ.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

/**
 * Exponential PDF: f(x; λ) = λ · exp(−λx) for x ≥ 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialPdf = (x: number, rate: number): number =>
  N.greaterThanOrEqualTo(x, 0)
    ? N.multiply(rate, Math.exp(N.negate(N.multiply(rate, x))))
    : 0

/**
 * Exponential log-PDF: ln f(x; λ) = ln(λ) − λx for x ≥ 0, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialLogpdf = (x: number, rate: number): number =>
  N.greaterThanOrEqualTo(x, 0)
    ? N.subtract(Math.log(rate), N.multiply(rate, x))
    : -Infinity

/**
 * Exponential CDF: F(x; λ) = 1 − exp(−λx) for x ≥ 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialCdf = (x: number, rate: number): number =>
  N.greaterThanOrEqualTo(x, 0)
    ? N.subtract(1, Math.exp(N.negate(N.multiply(rate, x))))
    : 0

/**
 * Exponential quantile (inverse CDF): Q(p; λ) = −ln(1 − p) / λ.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialQuantile = (p: number, rate: number): number =>
  N.unsafeDivide(N.negate(Math.log(N.subtract(1, p))), rate)

/**
 * Exponential mean: E[X] = 1 / λ.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialMean = (rate: number): number => N.unsafeDivide(1, rate)

/**
 * Exponential variance: Var(X) = 1 / λ².
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialVariance = (rate: number): number => N.unsafeDivide(1, N.multiply(rate, rate))

/**
 * Exponential differential entropy: H(X) = 1 − ln(λ).
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialEntropy = (rate: number): number => N.subtract(1, Math.log(rate))
