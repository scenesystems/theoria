/**
 * Pure kernels for normal and uniform distribution evaluation.
 * All functions are deterministic IEEE 754 leaf computations over
 * scalar arguments — no Effect context, no allocations.
 *
 * The standard normal CDF delegates to the `erf` kernel in
 * `Special/internal/erf.ts` via the identity Φ(x) = ½(1 + erf(x/√2)).
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { erfAbramowitzStegun } from "../../Special/internal/erf.js"

/**
 * Precomputed √(2π) for the standard normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const SQRT_2PI = Math.sqrt(N.multiply(2, Math.PI))

/**
 * Standard normal PDF: (1 / √(2π)) · exp(-x²/2).
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalPdf = (x: number): number =>
  N.multiply(
    N.unsafeDivide(1, SQRT_2PI),
    Math.exp(N.multiply(-0.5, N.multiply(x, x)))
  )

/**
 * Normal PDF with parameters mu and sigma:
 * φ((x − μ) / σ) / σ
 *
 * @since 0.1.0
 * @category internal
 */
export const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = N.unsafeDivide(N.subtract(x, mu), sigma)
  return N.unsafeDivide(standardNormalPdf(z), sigma)
}

/**
 * Standard normal CDF: Φ(x) = ½(1 + erf(x / √2)).
 *
 * Delegates to `erfAbramowitzStegun` from the Special domain — the
 * single source of truth for the A&S 7.1.26 rational approximation.
 * Accurate to ~1.5 × 10⁻⁷ for all real x.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalCdf = (x: number): number =>
  N.multiply(0.5, N.sum(1, erfAbramowitzStegun(N.unsafeDivide(x, Math.SQRT2))))

/**
 * Normal CDF with parameters mu and sigma:
 * Φ((x − μ) / σ)
 *
 * @since 0.1.0
 * @category internal
 */
export const normalCdf = (x: number, mu: number, sigma: number): number =>
  standardNormalCdf(N.unsafeDivide(N.subtract(x, mu), sigma))

/**
 * Uniform PDF: 1 / (high − low) when low ≤ x ≤ high, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformPdf = (x: number, low: number, high: number): number =>
  (N.greaterThanOrEqualTo(x, low) && N.lessThanOrEqualTo(x, high))
    ? N.unsafeDivide(1, N.subtract(high, low))
    : 0

/**
 * Uniform CDF: 0 when x < low, 1 when x > high,
 * (x − low) / (high − low) otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformCdf = (x: number, low: number, high: number): number =>
  N.lessThan(x, low) ?
    0
    : N.greaterThan(x, high) ?
    1
    : N.unsafeDivide(N.subtract(x, low), N.subtract(high, low))
