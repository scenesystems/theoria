/**
 * Poisson distribution kernels.
 * Parameter: mu (λ > 0, mean rate).
 * Support: k ∈ {0, 1, 2, ...}.
 *
 * CDF uses the regularized upper incomplete gamma function identity:
 *   P(X ≤ k) = Q(k+1, μ) = 1 - P(k+1, μ)
 * where P is the regularized lower incomplete gamma function.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { gammaincc, lnGamma } from "../../Special/operations.js"

/**
 * Log-PMF: k·ln(μ) − μ − ln(Γ(k+1)).
 * Edge case: μ=0 → k==0 ? 0 : -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonLogPmf = (k: number, mu: number): number => {
  if (N.lessThan(k, 0) || Math.floor(k) !== k) return -Infinity
  if (mu === 0) return k === 0 ? 0 : -Infinity

  return N.subtract(
    N.subtract(N.multiply(k, Math.log(mu)), mu),
    lnGamma(N.sum(k, 1))
  )
}

/**
 * PMF: exp(logPmf). Returns 0 for k < 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonPmf = (k: number, mu: number): number => {
  if (N.lessThan(k, 0) || Math.floor(k) !== k) return 0
  return Math.exp(poissonLogPmf(k, mu))
}

/**
 * CDF: P(X ≤ k) = Q(k+1, μ) = gammaincc(k+1, μ).
 * Edge case: μ=0 → 1 for all k ≥ 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonCdf = (k: number, mu: number): number => {
  if (N.lessThan(k, 0)) return 0
  if (mu === 0) return 1
  return gammaincc(N.sum(k, 1), mu)
}

/**
 * Mean: E[X] = μ.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonMean = (mu: number): number => mu

/**
 * Variance: Var(X) = μ.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonVariance = (mu: number): number => mu
