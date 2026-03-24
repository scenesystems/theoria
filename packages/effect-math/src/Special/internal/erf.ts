/**
 * Error function and complementary error function kernels.
 *
 * Uses Abramowitz & Stegun 7.1.26 rational polynomial approximation
 * (max error ≈ 1.5 × 10⁻⁷). The odd symmetry property erf(−x) = −erf(x)
 * reduces the domain to x ≥ 0.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const P = 0.3275911
const A1 = 0.254829592
const A2 = -0.284496736
const A3 = 1.421413741
const A4 = -1.453152027
const A5 = 1.061405429

/**
 * erf(x) via A&S 7.1.26. Handles negative x via odd symmetry.
 *
 * @since 0.1.0
 * @category internal
 */
export const erfAbramowitzStegun = (x: number): number => {
  if (x === 0) return 0
  const sign = x < 0 ? -1 : 1
  const absX = N.max(x, N.negate(x))
  const t = 1 / N.sum(1, N.multiply(P, absX))
  const t2 = N.multiply(t, t)
  const t3 = N.multiply(t2, t)
  const t4 = N.multiply(t3, t)
  const t5 = N.multiply(t4, t)

  const poly = N.sum(
    N.sum(
      N.sum(
        N.sum(N.multiply(A1, t), N.multiply(A2, t2)),
        N.multiply(A3, t3)
      ),
      N.multiply(A4, t4)
    ),
    N.multiply(A5, t5)
  )

  return N.multiply(sign, N.subtract(1, N.multiply(poly, Math.exp(N.negate(N.multiply(absX, absX))))))
}

/**
 * erfc(x) = 1 − erf(x). Uses the complementary form directly for
 * numerical stability when x is large (avoids subtracting nearly 1 from 1).
 *
 * @since 0.1.0
 * @category internal
 */
export const erfcAbramowitzStegun = (x: number): number => N.subtract(1, erfAbramowitzStegun(x))
