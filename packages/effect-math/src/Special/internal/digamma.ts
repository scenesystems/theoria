/**
 * Digamma (psi) function kernel using asymptotic expansion with
 * recurrence shifting.
 *
 * For x ≥ 7 the asymptotic series converges quickly:
 *   ψ(x) ≈ ln(x) − 1/(2x) − Σ B₂ₖ/(2k · x²ᵏ)
 *
 * For 0 < x < 7 the recurrence relation ψ(x+1) = ψ(x) + 1/x is
 * applied recursively to shift x into the asymptotic range.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

const ASYMPTOTIC_THRESHOLD = 7

const B2 = 1 / 6
const B4 = -1 / 30
const B6 = 1 / 42
const B8 = -1 / 30
const B10 = 5 / 66

/**
 * ψ(x) via asymptotic expansion. Assumes x ≥ 7.
 *
 * @since 0.1.0
 * @category internal
 */
const digammaAsymptotic = (x: number): number => {
  const invX = 1 / x
  const invX2 = N.multiply(invX, invX)

  return N.subtract(
    Math.log(x),
    N.sum(
      N.multiply(0.5, invX),
      N.multiply(
        invX2,
        N.sum(
          N.sum(
            N.sum(
              N.multiply(B2, 0.5),
              N.multiply(N.multiply(B4, invX2), 1 / 4)
            ),
            N.multiply(N.multiply(N.multiply(B6, invX2), invX2), 1 / 6)
          ),
          N.sum(
            N.multiply(N.multiply(N.multiply(N.multiply(B8, invX2), invX2), invX2), 1 / 8),
            N.multiply(N.multiply(N.multiply(N.multiply(N.multiply(B10, invX2), invX2), invX2), invX2), 1 / 10)
          )
        )
      )
    )
  )
}

/**
 * Recursive recurrence shift: ψ(x) = ψ(x+1) − 1/x until x ≥ threshold.
 *
 * @since 0.1.0
 * @category internal
 */
const digammaRecurrence = (x: number, correction: number): number =>
  x >= ASYMPTOTIC_THRESHOLD
    ? N.sum(correction, digammaAsymptotic(x))
    : digammaRecurrence(N.sum(x, 1), N.subtract(correction, 1 / x))

/**
 * ψ(x) for x > 0 using recurrence shifting into the asymptotic range.
 *
 * @since 0.1.0
 * @category internal
 */
export const digammaKernel = (x: number): number => digammaRecurrence(x, 0)
