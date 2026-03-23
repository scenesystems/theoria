/**
 * Pure kernels for normal and uniform distribution evaluation.
 * All functions are deterministic IEEE 754 leaf computations over
 * scalar arguments — no Effect context, no allocations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

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
 * Standard normal CDF via rational approximation (Abramowitz & Stegun).
 * Accurate to ~1.5 × 10⁻⁷ for all real x.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalCdf = (x: number): number => {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = N.sign(x)
  const absX = Math.abs(x)
  const t = N.unsafeDivide(1, N.sum(1, N.multiply(p, absX)))
  const t2 = N.multiply(t, t)
  const t3 = N.multiply(t2, t)
  const t4 = N.multiply(t3, t)
  const t5 = N.multiply(t4, t)
  const poly = N.sum(
    N.multiply(a1, t),
    N.sum(
      N.multiply(a2, t2),
      N.sum(
        N.multiply(a3, t3),
        N.sum(N.multiply(a4, t4), N.multiply(a5, t5))
      )
    )
  )
  const y = N.subtract(1, N.multiply(poly, Math.exp(N.multiply(N.negate(absX), absX))))
  return N.multiply(0.5, N.sum(1, N.multiply(sign, y)))
}

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
