/**
 * Binomial distribution kernels.
 * Parameters: n (trials, non-negative integer), p (success probability ∈ [0,1]).
 * Support: k ∈ {0, 1, ..., n}.
 *
 * CDF uses the regularized incomplete beta function identity:
 *   P(X ≤ k) = I_{1-p}(n-k, k+1) = 1 - I_p(k+1, n-k) for integer k.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { betaincKernel } from "../../Special/internal/betainc.js"
import { lnGammaLanczos } from "../../Special/internal/gamma.js"

/**
 * Log-PMF: ln C(n,k) + k·ln(p) + (n−k)·ln(1−p).
 * Edge cases: p=0 → k==0 ? 0 : -Infinity; p=1 → k==n ? 0 : -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialLogPmf = (k: number, n: number, p: number): number => {
  if (Math.floor(k) !== k || N.lessThan(k, 0) || N.greaterThan(k, n)) return -Infinity
  if (p === 0) return k === 0 ? 0 : -Infinity
  if (p === 1) return k === n ? 0 : -Infinity

  const lnCoeff = N.subtract(
    lnGammaLanczos(N.sum(n, 1)),
    N.sum(lnGammaLanczos(N.sum(k, 1)), lnGammaLanczos(N.sum(N.subtract(n, k), 1)))
  )

  return N.sum(
    lnCoeff,
    N.sum(
      N.multiply(k, Math.log(p)),
      N.multiply(N.subtract(n, k), Math.log(N.subtract(1, p)))
    )
  )
}

/**
 * PMF: exp(logPmf). Returns 0 for k outside support.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialPmf = (k: number, n: number, p: number): number => {
  if (Math.floor(k) !== k || N.lessThan(k, 0) || N.greaterThan(k, n)) return 0
  return Math.exp(binomialLogPmf(k, n, p))
}

/**
 * CDF: P(X ≤ k) = 1 − I_p(k+1, n−k) via regularized incomplete beta.
 * Edge cases: p=0 → k≥0 ? 1 : 0; p=1 → k≥n ? 1 : 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialCdf = (k: number, n: number, p: number): number => {
  if (N.lessThan(k, 0)) return 0
  if (N.greaterThanOrEqualTo(k, n)) return 1
  if (p === 0) return N.greaterThanOrEqualTo(k, 0) ? 1 : 0
  if (p === 1) return N.greaterThanOrEqualTo(k, n) ? 1 : 0

  return N.subtract(1, betaincKernel(N.sum(k, 1), N.subtract(n, k), p))
}

/**
 * Mean: E[X] = n · p.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialMean = (n: number, p: number): number => N.multiply(n, p)

/**
 * Variance: Var(X) = n · p · (1 − p).
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialVariance = (n: number, p: number): number => N.multiply(N.multiply(n, p), N.subtract(1, p))
