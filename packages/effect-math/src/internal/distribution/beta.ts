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
import { Boolean, Function, Match, Number, Schema } from "effect"

import { abs, exp, isFinite, log } from "../../Numeric.js"
import { digamma } from "../../Special.js"
import { betainc, betaLogNorm } from "../special/betainc.js"

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
 * Safeguarded Halley iteration inside a monotone beta-CDF bracket.
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
  return betaQuantileIteration(probabilityError, alpha, beta, logNormalization, 0, 1, initialX, 320)
}

const betaQuantileIteration = (
  probabilityError: (x: number) => number,
  alpha: number,
  beta: number,
  logNormalization: () => number,
  lower: number,
  upper: number,
  x: number,
  remaining: number
): number => {
  const midpoint = Number.unsafeDivide(Number.sum(lower, upper), 2)
  const exhaustedPrecision = Boolean.or(
    Number.Equivalence(midpoint, lower),
    Number.Equivalence(midpoint, upper)
  )
  return Boolean.match(Boolean.or(Number.Equivalence(remaining, 0), exhaustedPrecision), {
    onTrue: () => x,
    onFalse: () => {
      const difference = probabilityError(x)
      return Boolean.match(Number.Equivalence(difference, 0), {
        onTrue: () => x,
        onFalse: () => {
          const below = Number.lessThan(difference, 0)
          const nextLower = Boolean.match(below, { onTrue: () => x, onFalse: () => lower })
          const nextUpper = Boolean.match(below, { onTrue: () => upper, onFalse: () => x })
          const bracketMidpoint = Number.unsafeDivide(Number.sum(nextLower, nextUpper), 2)
          const newtonStep = Number.unsafeDivide(difference, betaPdf(x, alpha, beta, logNormalization))
          const logDensityDerivative = Number.subtract(
            Number.unsafeDivide(Number.subtract(alpha, 1), x),
            Number.unsafeDivide(Number.subtract(beta, 1), Number.subtract(1, x))
          )
          const halleyDenominator = Number.subtract(
            1,
            Number.multiply(0.5, Number.multiply(newtonStep, logDensityDerivative))
          )
          const candidate = Number.subtract(
            x,
            Number.unsafeDivide(newtonStep, halleyDenominator)
          )
          return Boolean.match(Number.Equivalence(candidate, x), {
            onTrue: () => x,
            onFalse: () => {
              const useCandidate = Boolean.and(
                isFinite(candidate),
                Boolean.and(Number.greaterThan(candidate, nextLower), Number.lessThan(candidate, nextUpper))
              )
              const nextX = Boolean.match(useCandidate, { onTrue: () => candidate, onFalse: () => bracketMidpoint })
              return betaQuantileIteration(
                probabilityError,
                alpha,
                beta,
                logNormalization,
                nextLower,
                nextUpper,
                nextX,
                Number.subtract(remaining, 1)
              )
            }
          })
        }
      })
    }
  })
}

/**
 * Beta quantile (inverse CDF) via safeguarded, tail-aware Halley iteration.
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
      // In the extreme tail, the next incomplete-beta series term is below
      // binary64 precision, so the leading power term is already the rounded
      // quantile. This also avoids evaluating a subnormal CDF residual.
      const nextTermScale = Number.multiply(distance, abs(Number.subtract(oppositeShape, 1)))
      return Boolean.match(Number.lessThanOrEqualTo(nextTermScale, 1e-16), {
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
