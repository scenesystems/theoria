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
import { Boolean, Number, Schema } from "effect"

import { exp, log } from "../../Numeric.js"
import { betainc, lnGamma } from "../../Special.js"

const Integer = Schema.Number.pipe(Schema.int())

/**
 * Log-PMF: ln C(n,k) + k·ln(p) + (n−k)·ln(1−p).
 * Edge cases: p=0 → k==0 ? 0 : -Infinity; p=1 → k==n ? 0 : -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialLogpmf = (k: number, n: number, p: number): number => {
  return Boolean.match(
    Boolean.or(Boolean.not(Schema.is(Integer)(k)), Boolean.or(Number.lessThan(k, 0), Number.greaterThan(k, n))),
    {
      onTrue: () => -Infinity,
      onFalse: () =>
        Boolean.match(Number.Equivalence(p, 0), {
          onTrue: () => Boolean.match(Number.Equivalence(k, 0), { onTrue: () => 0, onFalse: () => -Infinity }),
          onFalse: () =>
            Boolean.match(Number.Equivalence(p, 1), {
              onTrue: () => Boolean.match(Number.Equivalence(k, n), { onTrue: () => 0, onFalse: () => -Infinity }),
              onFalse: () => {
                const lnCoefficient = Number.subtract(
                  lnGamma(Number.sum(n, 1)),
                  Number.sum(lnGamma(Number.sum(k, 1)), lnGamma(Number.sum(Number.subtract(n, k), 1)))
                )
                return Number.sum(
                  lnCoefficient,
                  Number.sum(
                    Number.multiply(k, log(p)),
                    Number.multiply(Number.subtract(n, k), log(Number.subtract(1, p)))
                  )
                )
              }
            })
        })
    }
  )
}

/**
 * PMF: exp(logpmf). Returns 0 for k outside support.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialPmf = (k: number, n: number, p: number): number => {
  return Boolean.match(
    Boolean.or(Boolean.not(Schema.is(Integer)(k)), Boolean.or(Number.lessThan(k, 0), Number.greaterThan(k, n))),
    {
      onTrue: () => 0,
      onFalse: () => exp(binomialLogpmf(k, n, p))
    }
  )
}

/**
 * CDF: P(X ≤ k) = 1 − I_p(k+1, n−k) via regularized incomplete beta.
 * Edge cases: p=0 → k≥0 ? 1 : 0; p=1 → k≥n ? 1 : 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialCdf = (k: number, n: number, p: number): number => {
  return Boolean.match(Number.lessThan(k, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.greaterThanOrEqualTo(k, n), {
        onTrue: () => 1,
        onFalse: () =>
          Boolean.match(Number.Equivalence(p, 0), {
            onTrue: () => 1,
            onFalse: () =>
              Boolean.match(Number.Equivalence(p, 1), {
                onTrue: () => 0,
                onFalse: () => Number.subtract(1, betainc(Number.sum(k, 1), Number.subtract(n, k), p))
              })
          })
      })
  })
}

/**
 * Mean: E[X] = n · p.
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialMean = (n: number, p: number): number => Number.multiply(n, p)

/**
 * Variance: Var(X) = n · p · (1 − p).
 *
 * @since 0.1.0
 * @category internal
 */
export const binomialVariance = (n: number, p: number): number =>
  Number.multiply(Number.multiply(n, p), Number.subtract(1, p))
