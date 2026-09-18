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
import { Boolean, Number, Schema } from "effect"

import { exp, log } from "../../Numeric.js"
import { gammaincc, lnGamma } from "../../Special.js"

const Integer = Schema.Number.pipe(Schema.int())

/**
 * Log-PMF: k·ln(μ) − μ − ln(Γ(k+1)).
 * Edge case: μ=0 → k==0 ? 0 : -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonLogpmf = (k: number, mu: number): number => {
  return Boolean.match(Boolean.or(Number.lessThan(k, 0), Boolean.not(Schema.is(Integer)(k))), {
    onTrue: () => Number.negate(Infinity),
    onFalse: () =>
      Boolean.match(Number.Equivalence(mu, 0), {
        onTrue: () =>
          Boolean.match(Number.Equivalence(k, 0), { onTrue: () => 0, onFalse: () => Number.negate(Infinity) }),
        onFalse: () =>
          Number.subtract(
            Number.subtract(Number.multiply(k, log(mu)), mu),
            lnGamma(Number.sum(k, 1))
          )
      })
  })
}

/**
 * PMF: exp(logpmf). Returns 0 for k < 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonPmf = (k: number, mu: number): number => {
  return Boolean.match(Boolean.or(Number.lessThan(k, 0), Boolean.not(Schema.is(Integer)(k))), {
    onTrue: () => 0,
    onFalse: () => exp(poissonLogpmf(k, mu))
  })
}

/**
 * CDF: P(X ≤ k) = Q(k+1, μ) = gammaincc(k+1, μ).
 * Edge case: μ=0 → 1 for all k ≥ 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const poissonCdf = (k: number, mu: number): number => {
  return Boolean.match(Number.lessThan(k, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.Equivalence(mu, 0), {
        onTrue: () => 1,
        onFalse: () => gammaincc(Number.sum(k, 1), mu)
      })
  })
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
