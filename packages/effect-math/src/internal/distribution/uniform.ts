/**
 * Uniform distribution kernels.
 * Parameters: low, high (low < high).
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number, Schema } from "effect"

import { log } from "../../Numeric.js"

const isNonNaN = Schema.is(Schema.NonNaN)
const hasOrderedInputs = (x: number, low: number, high: number): boolean =>
  Boolean.and(
    Boolean.and(isNonNaN(x), Boolean.and(isNonNaN(low), isNonNaN(high))),
    Boolean.and(Number.greaterThanOrEqualTo(x, low), Number.lessThanOrEqualTo(x, high))
  )

/**
 * Uniform PDF: f(x; a, b) = 1 / (b − a) for a ≤ x ≤ b, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformPdf = (x: number, low: number, high: number): number =>
  Boolean.match(hasOrderedInputs(x, low, high), {
    onTrue: () => Number.unsafeDivide(1, Number.subtract(high, low)),
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
    onTrue: () => Number.negate(log(Number.subtract(high, low))),
    onFalse: () => Number.negate(Infinity)
  })

/**
 * Uniform CDF: F(x; a, b) = 0 for x < a, 1 for x > b,
 * (x − a) / (b − a) otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformCdf = (x: number, low: number, high: number): number =>
  Boolean.match(Number.lessThan(x, low), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.greaterThan(x, high), {
        onTrue: () => 1,
        onFalse: () => Number.unsafeDivide(Number.subtract(x, low), Number.subtract(high, low))
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
export const uniformMean = (low: number, high: number): number => Number.unsafeDivide(Number.sum(low, high), 2)

/**
 * Uniform variance: Var(X) = (b − a)² / 12.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformVariance = (low: number, high: number): number => {
  const range = Number.subtract(high, low)
  return Number.unsafeDivide(Number.multiply(range, range), 12)
}

/**
 * Uniform differential entropy: H(X) = ln(b − a).
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformEntropy = (low: number, high: number): number => log(Number.subtract(high, low))
