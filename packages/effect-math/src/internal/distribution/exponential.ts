/**
 * Exponential distribution kernels.
 * Parameter: rate (λ > 0). Mean = 1/λ.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number, Schema } from "effect"

import { exp, expm1, log, log1p } from "../../Numeric.js"

const isNonNaN = Schema.is(Schema.NonNaN)
const isInSupport = (value: number): boolean => Boolean.and(isNonNaN(value), Number.greaterThanOrEqualTo(value, 0))

/**
 * Exponential PDF: f(x; λ) = λ · exp(−λx) for x ≥ 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialPdf = (x: number, rate: number): number =>
  Boolean.match(isInSupport(x), {
    onTrue: () => Number.multiply(rate, exp(Number.negate(Number.multiply(rate, x)))),
    onFalse: () => 0
  })

/**
 * Exponential log-PDF: ln f(x; λ) = ln(λ) − λx for x ≥ 0, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialLogpdf = (x: number, rate: number): number =>
  Boolean.match(isInSupport(x), {
    onTrue: () => Number.subtract(log(rate), Number.multiply(rate, x)),
    onFalse: () => Number.negate(Infinity)
  })

/**
 * Exponential CDF: F(x; λ) = 1 − exp(−λx) for x ≥ 0, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialCdf = (x: number, rate: number): number =>
  Boolean.match(isInSupport(x), {
    onTrue: () => Number.negate(expm1(Number.negate(Number.multiply(rate, x)))),
    onFalse: () => 0
  })

/**
 * Exponential quantile (inverse CDF): Q(p; λ) = −ln(1 − p) / λ.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialQuantile = (p: number, rate: number): number =>
  Number.unsafeDivide(Number.negate(log1p(Number.negate(p))), rate)

/**
 * Exponential mean: E[X] = 1 / λ.
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialMean = (rate: number): number => Number.unsafeDivide(1, rate)

/**
 * Exponential variance: Var(X) = 1 / λ².
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialVariance = (rate: number): number => Number.unsafeDivide(1, Number.multiply(rate, rate))

/**
 * Exponential differential entropy: H(X) = 1 − ln(λ).
 *
 * @since 0.1.0
 * @category internal
 */
export const exponentialEntropy = (rate: number): number => Number.subtract(1, log(rate))
