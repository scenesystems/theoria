/**
 * Beta distribution kernels.
 * Parameters: alpha > 0, beta > 0. Support: x ∈ [0, 1].
 *
 * CDF and normalization delegate to canonical public Special operations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, Number, Option, Schema, Tuple } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { betainc, digamma, lnGamma } from "../../Special.js"

class BetaQuantileState extends Schema.Class<BetaQuantileState>("BetaQuantileState")({
  x: Schema.Number,
  remaining: Schema.Number
}) {}

const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * Log of the Beta function B(a,b) = Γ(a)Γ(b)/Γ(a+b).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogNorm = (a: number, b: number): number =>
  Number.subtract(
    Number.sum(lnGamma(a), lnGamma(b)),
    lnGamma(Number.sum(a, b))
  )

/**
 * Beta PDF: x^{α−1}(1−x)^{β−1} / B(α,β) for x ∈ (0,1).
 *
 * Handles boundary cases: x = 0 when α = 1, x = 1 when β = 1.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaPdf = (x: number, alpha: number, beta: number): number => {
  return Boolean.match(
    Boolean.and(isNonNaN(x), Boolean.or(Number.lessThanOrEqualTo(x, 0), Number.greaterThanOrEqualTo(x, 1))),
    {
      onTrue: () =>
        Boolean.match(Boolean.and(Number.Equivalence(x, 0), Number.Equivalence(alpha, 1)), {
          onTrue: () => exp(Number.negate(betaLogNorm(alpha, beta))),
          onFalse: () =>
            Boolean.match(Boolean.and(Number.Equivalence(x, 1), Number.Equivalence(beta, 1)), {
              onTrue: () => exp(Number.negate(betaLogNorm(alpha, beta))),
              onFalse: () => 0
            })
        }),
      onFalse: () =>
        exp(
          Number.subtract(
            Number.sum(
              Number.multiply(Number.subtract(alpha, 1), log(x)),
              Number.multiply(Number.subtract(beta, 1), log(Number.subtract(1, x)))
            ),
            betaLogNorm(alpha, beta)
          )
        )
    }
  )
}

/**
 * Beta log-PDF: (α−1)ln(x) + (β−1)ln(1−x) − ln B(α,β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogpdf = (x: number, alpha: number, beta: number): number => {
  return Boolean.match(
    Boolean.and(isNonNaN(x), Boolean.or(Number.lessThanOrEqualTo(x, 0), Number.greaterThanOrEqualTo(x, 1))),
    {
      onTrue: () => -Infinity,
      onFalse: () =>
        Number.subtract(
          Number.sum(
            Number.multiply(Number.subtract(alpha, 1), log(x)),
            Number.multiply(Number.subtract(beta, 1), log(Number.subtract(1, x)))
          ),
          betaLogNorm(alpha, beta)
        )
    }
  )
}

/**
 * Beta CDF via regularized incomplete beta I_x(α,β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaCdf = (x: number, alpha: number, beta: number): number => {
  return Boolean.match(isNonNaN(x), {
    onFalse: () => NaN,
    onTrue: () =>
      Boolean.match(Number.lessThanOrEqualTo(x, 0), {
        onTrue: () => 0,
        onFalse: () =>
          Boolean.match(Number.greaterThanOrEqualTo(x, 1), {
            onTrue: () => 1,
            onFalse: () => betainc(alpha, beta, x)
          })
      })
  })
}

/**
 * Schema-state Newton–Raphson iteration for the beta quantile.
 *
 * @since 0.1.0
 * @category internal
 */
const betaQuantileLoop = (
  p: number,
  alpha: number,
  beta: number,
  x: number,
  remaining: number
): number => {
  const initial = new BetaQuantileState({ x, remaining })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) => {
      const difference = Number.subtract(betaCdf(state.x, alpha, beta), p)
      const density = betaPdf(state.x, alpha, beta)
      return Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Boolean.or(Number.lessThan(density, 1e-30), Number.lessThan(abs(difference), 1e-12))
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const next = new BetaQuantileState({
              x: Number.clamp(Number.subtract(state.x, Number.unsafeDivide(difference, density)), {
                minimum: 1e-15,
                maximum: Number.subtract(1, 1e-15)
              }),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.x, next))
          }
        }
      )
    }),
    x,
    (_x, next) => next
  )
}

/**
 * Beta quantile (inverse CDF) via Newton–Raphson iteration.
 *
 * Returns x such that I_x(α,β) ≈ p. Clamped to [1e-15, 1−1e-15].
 *
 * @since 0.1.0
 * @category internal
 */
export const betaQuantile = (p: number, alpha: number, beta: number): number =>
  betaQuantileLoop(p, alpha, beta, 0.5, 20)

/**
 * Beta mean: α / (α + β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaMean = (alpha: number, beta: number): number => Number.unsafeDivide(alpha, Number.sum(alpha, beta))

/**
 * Beta variance: αβ / ((α+β)²(α+β+1)).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaVariance = (alpha: number, beta: number): number => {
  const ab = Number.sum(alpha, beta)
  return Number.unsafeDivide(
    Number.multiply(alpha, beta),
    Number.multiply(Number.multiply(ab, ab), Number.sum(ab, 1))
  )
}

/**
 * Beta differential entropy:
 * ln B(α,β) − (α−1)ψ(α) − (β−1)ψ(β) + (α+β−2)ψ(α+β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaEntropy = (alpha: number, beta: number): number =>
  Number.sum(
    Number.subtract(
      betaLogNorm(alpha, beta),
      Number.sum(
        Number.multiply(Number.subtract(alpha, 1), digamma(alpha)),
        Number.multiply(Number.subtract(beta, 1), digamma(beta))
      )
    ),
    Number.multiply(Number.subtract(Number.sum(alpha, beta), 2), digamma(Number.sum(alpha, beta)))
  )
