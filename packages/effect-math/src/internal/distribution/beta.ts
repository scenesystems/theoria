/**
 * Beta distribution kernels.
 * Parameters: alpha > 0, beta > 0. Support: x ∈ [0, 1].
 *
 * CDF and normalization delegate to canonical public Special operations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Match, Number, Option, Tuple } from "effect"

import { exp, isFinite, log } from "../../Numeric.js"
import { betainc, digamma, lnGamma } from "../../Special.js"

class BetaQuantileState extends Data.Class<{
  readonly lower: number
  readonly upper: number
  readonly x: number
  readonly remaining: number
}> {}

const isNonNaN = (value: number): boolean => Boolean.not(Number.Equivalence(value, NaN))

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
 * At either endpoint the density is infinite when the corresponding shape is
 * below one, finite when it equals one, and zero when it is above one.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaPdf = (x: number, alpha: number, beta: number): number => {
  return Match.value(x).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), () => NaN),
    Match.when(Number.isLessThan(0), () => 0),
    Match.when(Number.isGreaterThan(1), () => 0),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(alpha, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => exp(Number.multiply(-1, betaLogNorm(alpha, beta)))),
        Match.when(1, () => 0),
        Match.exhaustive
      )),
    Match.when((value) => Number.Equivalence(value, 1), () =>
      Match.value(Number.Order(beta, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => exp(Number.multiply(-1, betaLogNorm(alpha, beta)))),
        Match.when(1, () => 0),
        Match.exhaustive
      )),
    Match.orElse(() =>
      exp(
        Number.subtract(
          Number.sum(
            Number.multiply(Number.subtract(alpha, 1), log(x)),
            Number.multiply(Number.subtract(beta, 1), log(Number.subtract(1, x)))
          ),
          betaLogNorm(alpha, beta)
        )
      )
    )
  )
}

/**
 * Beta log-PDF: (α−1)ln(x) + (β−1)ln(1−x) − ln B(α,β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogpdf = (x: number, alpha: number, beta: number): number => {
  return Match.value(x).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), () => NaN),
    Match.when(Number.isLessThan(0), () => -Infinity),
    Match.when(Number.isGreaterThan(1), () => -Infinity),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(alpha, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.multiply(-1, betaLogNorm(alpha, beta))),
        Match.when(1, () => -Infinity),
        Match.exhaustive
      )),
    Match.when((value) => Number.Equivalence(value, 1), () =>
      Match.value(Number.Order(beta, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.multiply(-1, betaLogNorm(alpha, beta))),
        Match.when(1, () => -Infinity),
        Match.exhaustive
      )),
    Match.orElse(() =>
      Number.subtract(
        Number.sum(
          Number.multiply(Number.subtract(alpha, 1), log(x)),
          Number.multiply(Number.subtract(beta, 1), log(Number.subtract(1, x)))
        ),
        betaLogNorm(alpha, beta)
      )
    )
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
      Boolean.match(Number.isLessThanOrEqualTo(x, 0), {
        onTrue: () => 0,
        onFalse: () =>
          Boolean.match(Number.isGreaterThanOrEqualTo(x, 1), {
            onTrue: () => 1,
            onFalse: () => betainc(alpha, beta, x)
          })
      })
  })
}

/**
 * Safeguarded Newton iteration inside a monotone beta-CDF bracket.
 *
 * @since 0.1.0
 * @category internal
 */
const betaQuantileLoop = (
  p: number,
  alpha: number,
  beta: number,
  initialX: number
): number => {
  const upperTail = Number.isGreaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, betainc(beta, alpha, Number.subtract(1, x))),
      onFalse: () => Number.subtract(betainc(alpha, beta, x), target)
    })
  const initial = new BetaQuantileState({ lower: 0, upper: 1, x: initialX, remaining: 320 })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) => {
      const width = Number.subtract(state.upper, state.lower)
      const bracketMidpoint = Number.divideUnsafe(Number.sum(state.lower, state.upper), 2)
      const exhaustedPrecision = Boolean.or(
        Number.Equivalence(bracketMidpoint, state.lower),
        Number.Equivalence(bracketMidpoint, state.upper)
      )
      return Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Boolean.or(Number.isLessThanOrEqualTo(width, 5e-324), exhaustedPrecision)
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const difference = probabilityError(state.x)
            const below = Number.isLessThan(difference, 0)
            const lower = Boolean.match(below, { onTrue: () => state.x, onFalse: () => state.lower })
            const upper = Boolean.match(below, { onTrue: () => state.upper, onFalse: () => state.x })
            const midpoint = Number.divideUnsafe(Number.sum(lower, upper), 2)
            const candidate = Number.subtract(state.x, Number.divideUnsafe(difference, betaPdf(state.x, alpha, beta)))
            const useCandidate = Boolean.and(
              isFinite(candidate),
              Boolean.and(Number.isGreaterThan(candidate, lower), Number.isLessThan(candidate, upper))
            )
            const next = new BetaQuantileState({
              lower,
              upper,
              x: Boolean.match(useCandidate, { onTrue: () => candidate, onFalse: () => midpoint }),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.x, next))
          }
        }
      )
    }),
    initialX,
    (_x, next) => next
  )
}

/**
 * Beta quantile (inverse CDF) via safeguarded, tail-aware Newton iteration.
 *
 * Exact endpoint probabilities map to the exact support endpoints. Interior
 * estimates remain bracketed in [0,1], with direct survival-probability
 * evaluation in the upper tail to avoid cancellation.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaQuantile = (p: number, alpha: number, beta: number): number =>
  Match.value(p).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), () => NaN),
    Match.when(Number.isLessThanOrEqualTo(0), () => 0),
    Match.when(Number.isGreaterThanOrEqualTo(1), () => 1),
    Match.orElse((p) => {
      const upperTail = Number.isGreaterThan(p, 0.5)
      const tailProbability = Boolean.match(upperTail, {
        onTrue: () => Number.subtract(1, p),
        onFalse: () => p
      })
      const tailShape = Boolean.match(upperTail, { onTrue: () => beta, onFalse: () => alpha })
      const oppositeShape = Boolean.match(upperTail, { onTrue: () => alpha, onFalse: () => beta })
      const distance = exp(Number.divideUnsafe(
        Number.sum(
          Number.sum(log(tailProbability), log(tailShape)),
          betaLogNorm(tailShape, oppositeShape)
        ),
        tailShape
      ))
      const estimate = Boolean.match(upperTail, {
        onTrue: () => Number.subtract(1, distance),
        onFalse: () => distance
      })
      const interior = Boolean.and(Number.isGreaterThan(estimate, 0), Number.isLessThan(estimate, 1))
      const initial = Boolean.match(interior, {
        onTrue: () => estimate,
        onFalse: () => Number.divideUnsafe(alpha, Number.sum(alpha, beta))
      })
      // An underflowed tail distance already rounds to its support endpoint.
      return Boolean.match(Number.Equivalence(distance, 0), {
        onTrue: () => estimate,
        onFalse: () => betaQuantileLoop(p, alpha, beta, initial)
      })
    })
  )

/**
 * Beta mean: α / (α + β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaMean = (alpha: number, beta: number): number => Number.divideUnsafe(alpha, Number.sum(alpha, beta))

/**
 * Beta variance: αβ / ((α+β)²(α+β+1)).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaVariance = (alpha: number, beta: number): number => {
  const ab = Number.sum(alpha, beta)
  return Number.divideUnsafe(
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
