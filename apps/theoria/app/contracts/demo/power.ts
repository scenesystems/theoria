/**
 * Pure power analysis computations built on effect-math Distribution kernels.
 *
 * Provides standard error, non-centrality parameter, two-sided power,
 * required sample size (binary search), overlap coefficient, PDF curve
 * generation, and power curves — all as pure functions with no Effect wrapper.
 *
 * @since 0.1.0
 * @module
 */
import * as Arr from "effect/Array"

import { normalCdf, normalPdf, normalQuantile } from "effect-math/Distribution"

export const defaultPowerControls: {
  readonly d: 0.5
  readonly n: 30
  readonly alpha: 0.05
} = {
  d: 0.5,
  n: 30,
  alpha: 0.05
}
export const powerEffectSizeMin = 0.1
export const powerEffectSizeMax = 2.0
export const powerEffectSizeStep = 0.05
export const powerSampleSizeMin = 5
export const powerSampleSizeMax = 200
export const powerSampleSizeStep = 1
export const powerAlphaMin = 0.01
export const powerAlphaMax = 0.1
export const powerAlphaStep = 0.01

// ---------------------------------------------------------------------------
// Core power analysis kernels
// ---------------------------------------------------------------------------

/**
 * Standard error for an equal-group two-sample comparison: SE = √(2/n).
 *
 * @since 0.1.0
 * @category power analysis
 */
export const standardError = (n: number): number => Math.sqrt(2 / n)

/**
 * Non-centrality parameter for a two-sample test: δ = d / SE(n) = d · √(n/2).
 *
 * @since 0.1.0
 * @category power analysis
 */
export const nonCentrality = (d: number, n: number): number => d * Math.sqrt(n / 2)

/**
 * Two-sided power using the normal approximation.
 *
 * criticalZ = Φ⁻¹(1 − α/2)
 * δ = d · √(n/2)
 * power = 1 − Φ(criticalZ − δ) + Φ(−criticalZ − δ)
 *
 * @since 0.1.0
 * @category power analysis
 */
export const power = (d: number, n: number, alpha: number): number => {
  const criticalZ = normalQuantile(1 - alpha / 2, 0, 1)
  const delta = nonCentrality(d, n)
  return 1 - normalCdf(criticalZ - delta, 0, 1) + normalCdf(-criticalZ - delta, 0, 1)
}

/**
 * Minimum per-group sample size achieving `targetPower` via binary search
 * over N ∈ [2, 10000].
 *
 * Returns `Infinity` when the target is unreachable (e.g. d ≈ 0 or
 * targetPower ≤ alpha), since no finite sample size can deliver power
 * beyond the significance level for a zero effect.
 *
 * @since 0.1.0
 * @category power analysis
 */
export const requiredN = (d: number, targetPower: number, alpha: number): number => {
  if (Math.abs(d) < 1e-12) return Infinity
  if (targetPower <= alpha) return 2

  const upperBound = 10_000

  if (power(d, upperBound, alpha) < targetPower) return Infinity

  const search = (low: number, high: number): number =>
    low >= high
      ? low
      : (() => {
        const mid = (low + high) >>> 1
        return power(d, mid, alpha) >= targetPower
          ? search(low, mid)
          : search(mid + 1, high)
      })()

  return search(2, upperBound)
}

// ---------------------------------------------------------------------------
// Distribution geometry
// ---------------------------------------------------------------------------

/**
 * Overlap coefficient (OVL) of two unit-variance normals separated by d:
 * OVL = 2 · Φ(−d/2).
 *
 * @since 0.1.0
 * @category distribution geometry
 */
export const overlapCoefficient = (d: number): number => 2 * normalCdf(-d / 2, 0, 1)

// ---------------------------------------------------------------------------
// Curve generation
// ---------------------------------------------------------------------------

/**
 * Generate evenly spaced points for rendering a normal PDF curve.
 *
 * @since 0.1.0
 * @category curve generation
 */
export const pdfCurvePoints = (
  mu: number,
  sigma: number,
  xMin: number,
  xMax: number,
  steps: number
): ReadonlyArray<{ readonly x: number; readonly y: number }> => {
  const step = (xMax - xMin) / steps
  return Arr.map(Arr.range(0, steps), (index) => {
    const x = xMin + index * step
    return { x, y: normalPdf(x, mu, sigma) }
  })
}

/**
 * Power at each sample size — produces a curve suitable for plotting
 * power as a function of N.
 *
 * @since 0.1.0
 * @category curve generation
 */
export const powerCurve = (
  d: number,
  alpha: number,
  nValues: ReadonlyArray<number>
): ReadonlyArray<{ readonly n: number; readonly power: number }> =>
  nValues.map((n) => ({ n, power: power(d, n, alpha) }))
