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
import { Boolean, Function, Number } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { lnGammaLanczos } from "./gamma.js"

const maxIterations = 200
const epsilon = 1e-14
const minimumPositive = 1e-30
const addOne = Number.sum(1)
const subtractOne = Number.subtract(1)
const scaleByEpsilon = Number.multiply(epsilon)

/** Clamp tiny values away from zero to prevent division overflow. */
const useMinimumPositive = (_value: number): number => minimumPositive
const selectGuard = Boolean.match({
  onTrue: () => useMinimumPositive,
  onFalse: () => Function.identity<number>
})
const guard = (value: number): number => selectGuard(Number.lessThan(abs(value), minimumPositive))(value)

/**
 * Series expansion for P(a,x).
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
): number =>
  selectSeriesStep(
    Boolean.or(
      Number.Equivalence(remaining, 0),
      Number.lessThan(term, scaleByEpsilon(sum))
    )
  )(x, ap, term, sum, remaining)

const seriesDone = (_x: number, _ap: number, _term: number, sum: number, _remaining: number): number => sum

const seriesNext = (x: number, ap: number, term: number, sum: number, remaining: number): number => {
  const apNext = addOne(ap)
  const termNext = Number.multiply(term, Number.unsafeDivide(x, apNext))
  return gammaincSeriesLoop(
    x,
    apNext,
    termNext,
    Number.sum(sum, termNext),
    subtractOne(remaining)
  )
}

const selectSeriesStep = Boolean.match({
  onTrue: () => seriesDone,
  onFalse: () => seriesNext
})

const gammaincSeries = (a: number, x: number, logGamma: number): number => {
  const lnPrefix = Number.subtract(Number.multiply(a, log(x)), Number.sum(x, logGamma))
  const initial = Number.unsafeDivide(1, a)
  const sum = gammaincSeriesLoop(x, a, initial, initial, maxIterations)
  return Number.multiply(exp(lnPrefix), sum)
}

/**
 * Modified Lentz CF for Q(a,x).
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
  iteration: number
): number => selectFractionLimit(Number.greaterThan(iteration, maxIterations))(a, x, f, c, d, iteration)

const fractionDone = (
  _a: number,
  _x: number,
  f: number,
  _c: number,
  _d: number,
  _iteration: number
): number => f

const fractionNext = (a: number, x: number, f: number, c: number, d: number, iteration: number): number => {
  const an = Number.multiply(iteration, Number.subtract(a, iteration))
  const bn = Number.sum(Number.sum(x, 1), Number.subtract(Number.multiply(2, iteration), a))
  const dNext = Number.unsafeDivide(1, guard(Number.sum(bn, Number.multiply(an, d))))
  const cNext = guard(Number.sum(bn, Number.unsafeDivide(an, c)))
  const delta = Number.multiply(cNext, dNext)
  const fNext = Number.multiply(f, delta)
  return selectFractionConvergence(Number.lessThan(abs(Number.subtract(delta, 1)), epsilon))(
    a,
    x,
    fNext,
    cNext,
    dNext,
    iteration
  )
}

const fractionContinue = (
  a: number,
  x: number,
  f: number,
  c: number,
  d: number,
  iteration: number
): number => gammaincCFLoop(a, x, f, c, d, Number.sum(iteration, 1))

const selectFractionLimit = Boolean.match({
  onTrue: () => fractionDone,
  onFalse: () => fractionNext
})

const selectFractionConvergence = Boolean.match({
  onTrue: () => fractionDone,
  onFalse: () => fractionContinue
})

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
