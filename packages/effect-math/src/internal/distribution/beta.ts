/**
 * Beta distribution kernels.
 * Parameters: alpha > 0, beta > 0. Support: x ∈ [0, 1].
 *
 * CDF and normalization use the Special implementations, reusing shape-only
 * normalization throughout an inverse solve.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Function, Iterable, Match, Number, Option, Schema, Tuple } from "effect"

import { exp, isFinite, log } from "../../Numeric.js"
import { digamma } from "../../Special.js"
import { betainc, betaLogNorm } from "../special/betainc.js"

class BetaQuantileState extends Data.Class<{
  readonly lower: number
  readonly upper: number
  readonly x: number
  readonly remaining: number
}> {}

const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * Beta PDF: x^{α−1}(1−x)^{β−1} / B(α,β) for x ∈ (0,1).
 *
 * At either endpoint the density is infinite when the corresponding shape is
 * below one, finite when it equals one, and zero when it is above one.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaPdf = (
  x: number,
  alpha: number,
  beta: number,
  logNormalization: (alpha: number, beta: number) => number = betaLogNorm
): number => {
  return Match.value(x).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), () => NaN),
    Match.when(Number.lessThan(0), () => 0),
    Match.when(Number.greaterThan(1), () => 0),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(alpha, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => exp(Number.negate(logNormalization(alpha, beta)))),
        Match.when(1, () => 0),
        Match.exhaustive
      )),
    Match.when((value) => Number.Equivalence(value, 1), () =>
      Match.value(Number.Order(beta, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => exp(Number.negate(logNormalization(alpha, beta)))),
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
          logNormalization(alpha, beta)
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
    Match.when(Number.lessThan(0), () => Number.negate(Infinity)),
    Match.when(Number.greaterThan(1), () => Number.negate(Infinity)),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(alpha, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.negate(betaLogNorm(alpha, beta))),
        Match.when(1, () => Number.negate(Infinity)),
        Match.exhaustive
      )),
    Match.when((value) => Number.Equivalence(value, 1), () =>
      Match.value(Number.Order(beta, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.negate(betaLogNorm(alpha, beta))),
        Match.when(1, () => Number.negate(Infinity)),
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
 * Safeguarded Newton iteration inside a monotone beta-CDF bracket.
 *
 * @since 0.1.0
 * @category internal
 */
const betaQuantileLoop = (
  p: number,
  alpha: number,
  beta: number,
  initialX: number,
  logNormalization: () => number
): number => {
  const upperTail = Number.greaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, betainc(beta, alpha, Number.subtract(1, x), logNormalization)),
      onFalse: () => Number.subtract(betainc(alpha, beta, x, logNormalization), target)
    })
  const initial = new BetaQuantileState({ lower: 0, upper: 1, x: initialX, remaining: 320 })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) => {
      const width = Number.subtract(state.upper, state.lower)
      const bracketMidpoint = Number.unsafeDivide(Number.sum(state.lower, state.upper), 2)
      const exhaustedPrecision = Boolean.or(
        Number.Equivalence(bracketMidpoint, state.lower),
        Number.Equivalence(bracketMidpoint, state.upper)
      )
      return Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Boolean.or(Number.lessThanOrEqualTo(width, 5e-324), exhaustedPrecision)
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const difference = probabilityError(state.x)
            // A zero residual is already a root of the evaluated CDF. Do not
            // reject its zero Newton step and restart bisection away from it.
            return Boolean.match(Number.Equivalence(difference, 0), {
              onTrue: Option.none,
              onFalse: () => {
                const below = Number.lessThan(difference, 0)
                const lower = Boolean.match(below, { onTrue: () => state.x, onFalse: () => state.lower })
                const upper = Boolean.match(below, { onTrue: () => state.upper, onFalse: () => state.x })
                const midpoint = Number.unsafeDivide(Number.sum(lower, upper), 2)
                const candidate = Number.subtract(
                  state.x,
                  Number.unsafeDivide(difference, betaPdf(state.x, alpha, beta, logNormalization))
                )
                const useCandidate = Boolean.and(
                  isFinite(candidate),
                  Boolean.and(Number.greaterThan(candidate, lower), Number.lessThan(candidate, upper))
                )
                const next = new BetaQuantileState({
                  lower,
                  upper,
                  x: Boolean.match(useCandidate, { onTrue: () => candidate, onFalse: () => midpoint }),
                  remaining: Number.subtract(state.remaining, 1)
                })
                return Option.some(Tuple.make(next.x, next))
              }
            })
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
    Match.when(Number.lessThanOrEqualTo(0), () => 0),
    Match.when(Number.greaterThanOrEqualTo(1), () => 1),
    Match.orElse((p) => {
      const upperTail = Number.greaterThan(p, 0.5)
      const tailProbability = Boolean.match(upperTail, {
        onTrue: () => Number.subtract(1, p),
        onFalse: () => p
      })
      const tailShape = Boolean.match(upperTail, { onTrue: () => beta, onFalse: () => alpha })
      const oppositeShape = Boolean.match(upperTail, { onTrue: () => alpha, onFalse: () => beta })
      // B(a,b) is symmetric; the same normalization serves reflected CDFs and
      // the PDF without changing either expression's floating-point grouping.
      const logNormalization = Function.constant(betaLogNorm(tailShape, oppositeShape))
      const distance = exp(Number.unsafeDivide(
        Number.sum(
          Number.sum(log(tailProbability), log(tailShape)),
          logNormalization()
        ),
        tailShape
      ))
      const estimate = Boolean.match(upperTail, {
        onTrue: () => Number.subtract(1, distance),
        onFalse: () => distance
      })
      const interior = Boolean.and(Number.greaterThan(estimate, 0), Number.lessThan(estimate, 1))
      const initial = Boolean.match(interior, {
        onTrue: () => estimate,
        onFalse: () => Number.unsafeDivide(alpha, Number.sum(alpha, beta))
      })
      // An underflowed tail distance already rounds to its support endpoint.
      return Boolean.match(Number.Equivalence(distance, 0), {
        onTrue: () => estimate,
        onFalse: () => betaQuantileLoop(p, alpha, beta, initial, logNormalization)
      })
    })
  )

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
