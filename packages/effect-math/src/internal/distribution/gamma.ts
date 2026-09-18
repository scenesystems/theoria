/**
 * Gamma distribution kernels.
 * Parameters: shape (k > 0), scale (θ > 0). Mean = kθ.
 *
 * CDF and normalization use the Special implementations, reusing shape-only
 * normalization throughout an inverse solve.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Function, Iterable, Match, Number, Option, Predicate, Schema, Tuple } from "effect"

import { exp, isFinite, log } from "../../Numeric.js"
import { digamma, lnGamma } from "../../Special.js"
import { gammainc, gammaincc } from "../special/gammainc.js"

class GammaQuantileState extends Data.Class<{
  readonly lower: number
  readonly upper: number
  readonly x: number
  readonly remaining: number
}> {}

class GammaBracketState extends Data.Class<{
  readonly upper: number
  readonly remaining: number
}> {}

/**
 * Gamma PDF: x^{k−1} e^{−x/θ} / (θ^k Γ(k)) for x > 0.
 *
 * At zero the density is infinite below shape one, `1 / scale` at shape one,
 * and zero above shape one.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaPdf = (
  x: number,
  shape: number,
  scale: number,
  logGamma: (shape: number) => number = lnGamma
): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => 0),
    Match.when(Number.lessThan(0), () => 0),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(shape, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.unsafeDivide(1, scale)),
        Match.when(1, () => 0),
        Match.exhaustive
      )),
    Match.orElse(() =>
      exp(
        Number.subtract(
          Number.subtract(
            Number.multiply(Number.subtract(shape, 1), log(x)),
            Number.unsafeDivide(x, scale)
          ),
          Number.sum(
            Number.multiply(shape, log(scale)),
            logGamma(shape)
          )
        )
      )
    )
  )
}

/**
 * Gamma log-PDF: (k−1)ln(x) − x/θ − k·ln(θ) − ln Γ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLogpdf = (x: number, shape: number, scale: number): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => -Infinity),
    Match.when(Number.lessThan(0), () => -Infinity),
    Match.when((value) => Number.Equivalence(value, 0), () =>
      Match.value(Number.Order(shape, 1)).pipe(
        Match.when(-1, () => Infinity),
        Match.when(0, () => Number.negate(log(scale))),
        Match.when(1, () => -Infinity),
        Match.exhaustive
      )),
    Match.orElse(() =>
      Number.subtract(
        Number.subtract(
          Number.multiply(Number.subtract(shape, 1), log(x)),
          Number.unsafeDivide(x, scale)
        ),
        Number.sum(
          Number.multiply(shape, log(scale)),
          lnGamma(shape)
        )
      )
    )
  )
}

/**
 * Gamma CDF via regularized lower incomplete gamma P(k, x/θ).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaCdf = (x: number, shape: number, scale: number): number => {
  return Match.value(x).pipe(
    Match.when(Infinity, () => 1),
    Match.when(Number.lessThanOrEqualTo(0), () => 0),
    Match.orElse(() => gammainc(shape, Number.unsafeDivide(x, scale)))
  )
}

/**
 * Finds a finite standardized upper bracket by geometric expansion.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileUpper = (p: number, shape: number, logGamma: () => number): number => {
  const upperTail = Number.greaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, gammaincc(shape, x, logGamma)),
      onFalse: () => Number.subtract(gammainc(shape, x, logGamma), target)
    })
  const initial = new GammaBracketState({ upper: Number.max(1, shape), remaining: 1024 })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Boolean.match(
        Boolean.or(
          Number.greaterThanOrEqualTo(probabilityError(state.upper), 0),
          Boolean.or(Number.Equivalence(state.remaining, 0), Predicate.not(isFinite)(state.upper))
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const next = new GammaBracketState({
              upper: Number.multiply(state.upper, 2),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.upper, next))
          }
        }
      )),
    initial.upper,
    (_upper, next) => next
  )
}

/**
 * Safeguarded Newton iteration inside a monotone gamma-CDF bracket.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileLoop = (
  p: number,
  shape: number,
  upper: number,
  initialX: number,
  logGamma: () => number
): number => {
  const upperTail = Number.greaterThan(p, 0.5)
  const target = Boolean.match(upperTail, {
    onTrue: () => Number.subtract(1, p),
    onFalse: () => p
  })
  const probabilityError = (x: number): number =>
    Boolean.match(upperTail, {
      onTrue: () => Number.subtract(target, gammaincc(shape, x, logGamma)),
      onFalse: () => Number.subtract(gammainc(shape, x, logGamma), target)
    })
  const initial = new GammaQuantileState({ lower: 0, upper, x: initialX, remaining: 320 })
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
            // Preserve a zero CDF residual rather than rejecting the zero
            // Newton step at the bracket endpoint and bisecting again.
            return Boolean.match(Number.Equivalence(difference, 0), {
              onTrue: Option.none,
              onFalse: () => {
                const below = Number.lessThan(difference, 0)
                const lower = Boolean.match(below, { onTrue: () => state.x, onFalse: () => state.lower })
                const nextUpper = Boolean.match(below, { onTrue: () => state.upper, onFalse: () => state.x })
                const midpoint = Number.unsafeDivide(Number.sum(lower, nextUpper), 2)
                const candidate = Number.subtract(
                  state.x,
                  Number.unsafeDivide(difference, gammaPdf(state.x, shape, 1, logGamma))
                )
                const useCandidate = Boolean.and(
                  isFinite(candidate),
                  Boolean.and(Number.greaterThan(candidate, lower), Number.lessThan(candidate, nextUpper))
                )
                const next = new GammaQuantileState({
                  lower,
                  upper: nextUpper,
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
 * Gamma quantile (inverse CDF) via safeguarded, tail-aware Newton iteration.
 *
 * Exact endpoint probabilities map to the exact support endpoints. Interior
 * estimates use a geometrically expanded bracket and direct upper-tail
 * probability evaluation before applying the requested scale.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaQuantile = (p: number, shape: number, scale: number): number => {
  return Match.value(p).pipe(
    Match.when(Predicate.not(Schema.is(Schema.NonNaN)), () => NaN),
    Match.when(Number.lessThanOrEqualTo(0), () => 0),
    Match.when(Number.greaterThanOrEqualTo(1), () => Infinity),
    Match.orElse((p) => {
      const logGamma = Function.constant(lnGamma(shape))
      const upper = gammaQuantileUpper(p, shape, logGamma)
      const logLowerEstimate = Number.unsafeDivide(
        Number.sum(log(p), lnGamma(Number.sum(shape, 1))),
        shape
      )
      const lowerEstimate = exp(logLowerEstimate)
      const estimate = Boolean.match(Number.lessThanOrEqualTo(p, 0.5), {
        onTrue: () => lowerEstimate,
        onFalse: () => shape
      })
      const interior = Boolean.and(Number.greaterThan(estimate, 0), Number.lessThan(estimate, upper))
      const initial = Boolean.match(interior, {
        onTrue: () => estimate,
        onFalse: () => Number.unsafeDivide(upper, 2)
      })
      // Below standardized precision, P(a,x) ~ x^a / Gamma(a+1).
      // Apply scale in log space before rounding the physical quantile to zero.
      return Boolean.match(Number.Equivalence(lowerEstimate, 0), {
        onTrue: () => exp(Number.sum(logLowerEstimate, log(scale))),
        onFalse: () => Number.multiply(gammaQuantileLoop(p, shape, upper, initial, logGamma), scale)
      })
    })
  )
}

/**
 * Gamma mean: kθ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaMean = (shape: number, scale: number): number => Number.multiply(shape, scale)

/**
 * Gamma variance: kθ².
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaVariance = (shape: number, scale: number): number =>
  Number.multiply(shape, Number.multiply(scale, scale))

/**
 * Gamma differential entropy:
 * k + ln(θ) + ln Γ(k) + (1−k)ψ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaEntropy = (shape: number, scale: number): number =>
  Number.sum(
    Number.sum(shape, log(scale)),
    Number.sum(
      lnGamma(shape),
      Number.multiply(Number.subtract(1, shape), digamma(shape))
    )
  )
