/**
 * Uniform distribution kernels.
 * Parameters: low, high (low < high).
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

/**
 * Uniform PDF: f(x; a, b) = 1 / (b − a) for a ≤ x ≤ b, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformPdf = (x: number, low: number, high: number): number =>
  (N.greaterThanOrEqualTo(x, low) && N.lessThanOrEqualTo(x, high))
    ? N.unsafeDivide(1, N.subtract(high, low))
    : 0

/**
 * Uniform log-PDF: ln f(x; a, b) = −ln(b − a) for a ≤ x ≤ b, else −∞.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformLogpdf = (x: number, low: number, high: number): number =>
  (N.greaterThanOrEqualTo(x, low) && N.lessThanOrEqualTo(x, high))
    ? N.negate(Math.log(N.subtract(high, low)))
    : -Infinity

/**
 * Uniform CDF: F(x; a, b) = 0 for x < a, 1 for x > b,
 * (x − a) / (b − a) otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformCdf = (x: number, low: number, high: number): number =>
  N.lessThan(x, low)
    ? 0
    : N.greaterThan(x, high)
    ? 1
    : N.unsafeDivide(N.subtract(x, low), N.subtract(high, low))

/**
 * Uniform quantile (inverse CDF): Q(p; a, b) = a + p · (b − a).
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformQuantile = (p: number, low: number, high: number): number =>
  N.sum(low, N.multiply(p, N.subtract(high, low)))

/**
 * Uniform mean: E[X] = (a + b) / 2.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformMean = (low: number, high: number): number => N.unsafeDivide(N.sum(low, high), 2)

/**
 * Uniform variance: Var(X) = (b − a)² / 12.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformVariance = (low: number, high: number): number => {
  const range = N.subtract(high, low)
  return N.unsafeDivide(N.multiply(range, range), 12)
}

/**
 * Uniform differential entropy: H(X) = ln(b − a).
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformEntropy = (low: number, high: number): number => Math.log(N.subtract(high, low))
