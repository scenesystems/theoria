/**
 * Pure kernels for normal and uniform distribution evaluation.
 * All functions are deterministic IEEE 754 leaf computations over
 * scalar arguments — no Effect context, no allocations.
 *
 * The standard normal CDF delegates to the public Special error function via
 * the identity Φ(x) = ½(1 + erf(x/√2)).
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number, Schema } from "effect"

import { exp, pi, sqrt } from "../../Numeric/index.js"
import { erf, erfinv } from "../../Special/index.js"

/**
 * Precomputed √(2π) for the standard normal PDF denominator.
 *
 * @since 0.1.0
 * @category internal
 */
const SQRT_2 = sqrt(2)
const SQRT_2PI = sqrt(Number.multiply(2, pi))
const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * Numerical guard for probability-edge transforms that map `u ∈ (0, 1)`
 * into unbounded real support.
 *
 * @since 0.1.0
 * @category internal
 */
const UNIT_INTERVAL_EPSILON = 1e-12

const clampUnitRoll = (roll: number): number =>
  Number.clamp(roll, {
    minimum: UNIT_INTERVAL_EPSILON,
    maximum: Number.subtract(1, UNIT_INTERVAL_EPSILON)
  })

/**
 * Standard normal PDF: (1 / √(2π)) · exp(-x²/2).
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalPdf = (x: number): number =>
  Number.multiply(
    Number.unsafeDivide(1, SQRT_2PI),
    exp(Number.multiply(-0.5, Number.multiply(x, x)))
  )

/**
 * Normal PDF with parameters mu and sigma:
 * φ((x − μ) / σ) / σ
 *
 * @since 0.1.0
 * @category internal
 */
export const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = Number.unsafeDivide(Number.subtract(x, mu), sigma)
  return Number.unsafeDivide(standardNormalPdf(z), sigma)
}

/**
 * Standard normal CDF: Φ(x) = ½(1 + erf(x / √2)).
 *
 * Delegates to the multi-region Cephes `erf` operation from the Special domain.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardNormalCdf = (x: number): number =>
  Number.multiply(0.5, Number.sum(1, erf(Number.unsafeDivide(x, SQRT_2))))

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
  Number.multiply(SQRT_2, erfinv(Number.subtract(Number.multiply(2, clampUnitRoll(roll)), 1)))

/**
 * Normal CDF with parameters mu and sigma:
 * Φ((x − μ) / σ)
 *
 * @since 0.1.0
 * @category internal
 */
export const normalCdf = (x: number, mu: number, sigma: number): number =>
  standardNormalCdf(Number.unsafeDivide(Number.subtract(x, mu), sigma))

/**
 * Uniform PDF: 1 / (high − low) when low ≤ x ≤ high, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const uniformPdf = (x: number, low: number, high: number): number =>
  Boolean.match(Boolean.and(isNonNaN(x), Boolean.and(isNonNaN(low), isNonNaN(high))), {
    onTrue: () =>
      Boolean.match(Boolean.and(Number.greaterThanOrEqualTo(x, low), Number.lessThanOrEqualTo(x, high)), {
        onTrue: () => Number.unsafeDivide(1, Number.subtract(high, low)),
        onFalse: () => 0
      }),
    onFalse: () => 0
  })

/**
 * Uniform CDF: 0 when x < low, 1 when x > high,
 * (x − low) / (high − low) otherwise.
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
