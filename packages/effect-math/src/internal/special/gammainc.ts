/**
 * Regularized incomplete gamma function kernels.
 *
 * P(a,x) = γ(a,x)/Γ(a) via series expansion for x < a+1, and
 * Q(a,x) = 1 − P(a,x) via Legendre continued fraction (modified Lentz)
 * for x ≥ a+1. All normalization uses log-space via `lnGammaLanczos`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Data, Iterable, Number, Option, Tuple } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { lnGammaLanczos } from "./gamma.js"

const maxIterations = 200
const epsilon = 1e-14
const minimumPositive = 1e-30

class GammaincSeriesState extends Data.Class<{
  readonly ap: number
  readonly term: number
  readonly sum: number
  readonly remaining: number
}> {}

class GammaincCFState extends Data.Class<{
  readonly value: number
  readonly c: number
  readonly d: number
  readonly iteration: number
  readonly converged: boolean
}> {}

/** Clamp tiny values away from zero to prevent division overflow. */
const guard = (value: number): number =>
  Boolean.match(Number.lessThan(abs(value), minimumPositive), {
    onTrue: () => minimumPositive,
    onFalse: () => value
  })

/**
 * Iterable-driven series expansion for P(a,x).
 *
 * P(a,x) = e^{−x} x^a / Γ(a) · Σ_{n=0}^{∞} x^n / (a·(a+1)·…·(a+n))
 *
 * @since 0.1.0
 * @category internal
 */
const gammaincSeriesLoop = (
  x: number,
  ap: number,
  term: number,
  sum: number,
  remaining: number
): number => {
  const initial = new GammaincSeriesState({ ap, term, sum, remaining })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Number.lessThan(abs(state.term), Number.multiply(epsilon, abs(state.sum)))
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const apNext = Number.sum(state.ap, 1)
            const termNext = Number.multiply(state.term, Number.unsafeDivide(x, apNext))
            const next = new GammaincSeriesState({
              ap: apNext,
              term: termNext,
              sum: Number.sum(state.sum, termNext),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.sum, next))
          }
        }
      )),
    sum,
    (_sum, next) => next
  )
}

const gammaincSeries = (a: number, x: number, logGamma: number): number => {
  const lnPrefix = Number.subtract(Number.multiply(a, log(x)), Number.sum(x, logGamma))
  const initial = Number.unsafeDivide(1, a)
  const sum = gammaincSeriesLoop(x, a, initial, initial, maxIterations)
  return Number.multiply(exp(lnPrefix), sum)
}

/**
 * Iterable-driven modified Lentz CF for Q(a,x).
 *
 * Uses the Legendre CF representation of Γ(a,x)
 * (Gautschi, 1979; Lentz, 1976).
 *
 * CF: b₀ = x+1−a, a_n = n(a−n), b_n = x+1+2n−a
 *
 * @since 0.1.0
 * @category internal
 */
const gammaincCFLoop = (
  a: number,
  x: number,
  f: number,
  c: number,
  d: number,
  n: number
): number => {
  const initial = new GammaincCFState({ value: f, c, d, iteration: n, converged: false })
  const final = Iterable.reduce(
    Iterable.unfold(
      initial,
      (state) =>
        Boolean.match(Boolean.or(state.converged, Number.greaterThan(state.iteration, maxIterations)), {
          onTrue: Option.none,
          onFalse: () => {
            const an = Number.multiply(state.iteration, Number.subtract(a, state.iteration))
            const bn = Number.sum(Number.sum(x, 1), Number.subtract(Number.multiply(2, state.iteration), a))
            const dNext = Number.unsafeDivide(1, guard(Number.sum(bn, Number.multiply(an, state.d))))
            const cNext = guard(Number.sum(bn, Number.unsafeDivide(an, state.c)))
            const delta = Number.multiply(cNext, dNext)
            const next = new GammaincCFState({
              value: Number.multiply(state.value, delta),
              c: cNext,
              d: dNext,
              iteration: Number.sum(state.iteration, 1),
              converged: Number.lessThan(abs(Number.subtract(delta, 1)), epsilon)
            })
            return Option.some(Tuple.make(next, next))
          }
        })
    ),
    initial,
    (_state, next) => next
  )
  return final.value
}

const gammaincCF = (a: number, x: number, logGamma: number): number => {
  const lnPrefix = Number.subtract(Number.multiply(a, log(x)), Number.sum(x, logGamma))
  const b0 = Number.subtract(Number.sum(x, 1), a)
  const f0 = guard(b0)
  const result = gammaincCFLoop(a, x, f0, f0, 0, 1)
  return Number.multiply(exp(lnPrefix), Number.unsafeDivide(1, result))
}

/**
 * Regularized lower incomplete gamma P(a,x) = γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 * Internal inverse solves reuse log Γ(a); laziness preserves cheap endpoints.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammainc = (a: number, x: number, logGamma: (a: number) => number = lnGammaLanczos): number => {
  return Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.lessThan(x, Number.sum(a, 1)), {
        onTrue: () => gammaincSeries(a, x, logGamma(a)),
        onFalse: () => Number.subtract(1, gammaincCF(a, x, logGamma(a)))
      })
  })
}

/**
 * Regularized upper incomplete gamma Q(a,x) = 1 − P(a,x) = Γ(a,x)/Γ(a).
 *
 * Requires a > 0, x ≥ 0. Returns a value in [0, 1].
 * Internal inverse solves reuse log Γ(a); laziness preserves cheap endpoints.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaincc = (a: number, x: number, logGamma: (a: number) => number = lnGammaLanczos): number => {
  return Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 1,
    onFalse: () =>
      Boolean.match(Number.lessThan(x, Number.sum(a, 1)), {
        onTrue: () => Number.subtract(1, gammaincSeries(a, x, logGamma(a))),
        onFalse: () => gammaincCF(a, x, logGamma(a))
      })
  })
}
