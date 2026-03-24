/**
 * Regularized incomplete beta function kernel.
 *
 * I_x(a,b) = B(x;a,b) / B(a,b) via the Lentz continued fraction
 * (Numerical Recipes §6.4) with symmetry transform. Normalization
 * uses log-space via `lnGammaLanczos`.
 *
 * When x > (a+1)/(a+b+2) the symmetry identity I_x(a,b) = 1 − I_{1−x}(b,a)
 * is applied to ensure the continued fraction converges rapidly.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"
import { lnGammaLanczos } from "./gamma.js"

const MAX_ITERATIONS = 200
const EPSILON = 3e-14
const FPMIN = 1e-30

/** Clamp tiny values away from zero to prevent division overflow. */
const guard = (v: number): number => (Math.abs(v) < FPMIN ? FPMIN : v)

/**
 * Modified Lentz continued fraction for I_x(a,b).
 *
 * Returns the CF value that, when multiplied by the beta-prefix / a,
 * gives I_x(a,b). Follows Numerical Recipes betacf().
 *
 * @since 0.1.0
 * @category internal
 */
const betacf = (a: number, b: number, x: number): number => {
  const qab = N.sum(a, b)
  const qap = N.sum(a, 1)
  const qam = N.subtract(a, 1)

  const d0 = 1 / guard(N.subtract(1, N.multiply(qab, x) / qap))
  return betacfLoop(a, b, x, qab, qap, qam, d0, 1, d0, 1)
}

/**
 * Tail-recursive Lentz CF loop following NR betacf().
 *
 * All mutable Lentz state (h, c, d) is threaded through parameters.
 *
 * @since 0.1.0
 * @category internal
 */
const betacfLoop = (
  a: number,
  b: number,
  x: number,
  qab: number,
  qap: number,
  qam: number,
  h: number,
  cPrev: number,
  dPrev: number,
  m: number
): number => {
  if (m > MAX_ITERATIONS) return h

  const twoM = N.multiply(2, m)

  // Even coefficient: m(b−m)x / ((qam+2m)(a+2m))
  const numEven = N.multiply(N.multiply(m, N.subtract(b, m)), x) /
    N.multiply(N.sum(qam, twoM), N.sum(a, twoM))

  const d1 = 1 / guard(N.sum(1, N.multiply(numEven, dPrev)))
  const c1 = guard(N.sum(1, numEven / cPrev))
  const h1 = N.multiply(h, N.multiply(d1, c1))

  // Odd coefficient: −(a+m)(qab+m)x / ((a+2m)(qap+2m))
  const numOdd = N.negate(
    N.multiply(N.multiply(N.sum(a, m), N.sum(qab, m)), x) /
      N.multiply(N.sum(a, twoM), N.sum(qap, twoM))
  )

  const d2 = 1 / guard(N.sum(1, N.multiply(numOdd, d1)))
  const c2 = guard(N.sum(1, numOdd / c1))
  const delta = N.multiply(d2, c2)
  const h2 = N.multiply(h1, delta)

  if (Math.abs(N.subtract(delta, 1)) < EPSILON) return h2

  return betacfLoop(a, b, x, qab, qap, qam, h2, c2, d2, N.sum(m, 1))
}

/**
 * Regularized incomplete beta I_x(a,b) = B(x;a,b) / B(a,b).
 *
 * Requires a > 0, b > 0, 0 ≤ x ≤ 1. Returns a value in [0, 1].
 *
 * @since 0.1.0
 * @category internal
 */
export const betaincKernel = (a: number, b: number, x: number): number => {
  if (x === 0) return 0
  if (x === 1) return 1

  // Symmetry transform for convergence
  if (x > N.sum(a, 1) / N.sum(N.sum(a, b), 2)) {
    return N.subtract(1, betaincKernel(b, a, N.subtract(1, x)))
  }

  const lnPre = N.subtract(
    N.sum(
      N.multiply(a, Math.log(x)),
      N.multiply(b, Math.log(N.subtract(1, x)))
    ),
    N.sum(
      Math.log(a),
      N.subtract(
        N.sum(lnGammaLanczos(a), lnGammaLanczos(b)),
        lnGammaLanczos(N.sum(a, b))
      )
    )
  )

  return N.multiply(Math.exp(lnPre), betacf(a, b, x))
}
