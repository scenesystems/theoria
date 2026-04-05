/**
 * Pure kernels for normal and uniform distribution evaluation.
 * All functions are deterministic IEEE 754 leaf computations over
 * scalar arguments — no Effect context, no allocations.
 *
 * The standard normal CDF delegates to the Special-domain `erf`
 * owner surface via the identity Φ(x) = ½(1 + erf(x/√2)).
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { erf, erfinv } from "../../Special/operations.js"

/**
 * Precomputed √(2π) for the standard normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const SQRT_2PI = Math.sqrt(N.multiply(2, Math.PI))

/**
 * Numerical guard for probability-edge transforms that map `u ∈ (0, 1)`
 * into unbounded real support.
 *
 * @since 0.1.0
 * @category internal
 */
const UNIT_INTERVAL_EPSILON = 1e-12

const clampUnitRoll = (roll: number): number =>
  N.clamp(roll, {
    minimum: UNIT_INTERVAL_EPSILON,
    maximum: 1 - UNIT_INTERVAL_EPSILON
  })

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
 * Delegates to `erf` from the Special domain — the
 * single source of truth for the A&S 7.1.26 rational approximation.
 * Accurate to ~1.5 × 10⁻⁷ for all real x.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalCdf = (x: number): number => N.multiply(0.5, N.sum(1, erf(N.unsafeDivide(x, Math.SQRT2))))

/**
 * Standard-normal transform `u ↦ z` for `u ∈ (0, 1)` using the inverse-CDF
 * identity `Φ⁻¹(u) = √2 · erfinv(2u − 1)`.
 *
 * Inputs are clamped to `(ε, 1-ε)` so finite rolls from samplers never
 * produce `±Infinity` at the endpoints.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalTransform = (roll: number): number =>
  N.multiply(Math.SQRT2, erfinv(N.subtract(N.multiply(2, clampUnitRoll(roll)), 1)))

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
