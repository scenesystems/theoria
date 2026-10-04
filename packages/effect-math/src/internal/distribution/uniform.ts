/**
 * Uniform distribution kernels.
 * Parameters: low, high (low < high).
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number } from "effect"

import { log } from "../../Numeric.js"

const isNonNaN = (value: number): boolean => Boolean.not(Number.Equivalence(value, NaN))
const hasOrderedInputs = (x: number, low: number, high: number): boolean =>
  Boolean.and(
    Boolean.and(isNonNaN(x), Boolean.and(isNonNaN(low), isNonNaN(high))),
    Boolean.and(Number.isGreaterThanOrEqualTo(x, low), Number.isLessThanOrEqualTo(x, high))
  )

/**
 * Uniform PDF: f(x; a, b) = 1 / (b − a) for a ≤ x ≤ b, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformPdf = (x: number, low: number, high: number): number =>
  Boolean.match(hasOrderedInputs(x, low, high), {
    onTrue: () => Number.divideUnsafe(1, Number.subtract(high, low)),
    onFalse: () => 0
  })

/**
 * Uniform log-PDF: ln f(x; a, b) = −ln(b − a) for a ≤ x ≤ b, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformLogpdf = (x: number, low: number, high: number): number =>
  Boolean.match(hasOrderedInputs(x, low, high), {
    onTrue: () => Number.multiply(-1, log(Number.subtract(high, low))),
    onFalse: () => -Infinity
  })

/**
 * Uniform CDF: F(x; a, b) = 0 for x < a, 1 for x > b,
 * (x − a) / (b − a) otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformCdf = (x: number, low: number, high: number): number =>
  Boolean.match(Number.isLessThan(x, low), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.isGreaterThan(x, high), {
        onTrue: () => 1,
        onFalse: () => Number.divideUnsafe(Number.subtract(x, low), Number.subtract(high, low))
      })
  })

/**
 * Uniform quantile (inverse CDF): Q(p; a, b) = a + p · (b − a).
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformQuantile = (p: number, low: number, high: number): number =>
  Number.sum(low, Number.multiply(p, Number.subtract(high, low)))

/**
 * Uniform mean: E[X] = (a + b) / 2.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformMean = (low: number, high: number): number => Number.divideUnsafe(Number.sum(low, high), 2)

/**
 * Uniform variance: Var(X) = (b − a)² / 12.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformVariance = (low: number, high: number): number => {
  const range = Number.subtract(high, low)
  return Number.divideUnsafe(Number.multiply(range, range), 12)
}

/**
 * Uniform differential entropy: H(X) = ln(b − a).
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformEntropy = (low: number, high: number): number => log(Number.subtract(high, low))
