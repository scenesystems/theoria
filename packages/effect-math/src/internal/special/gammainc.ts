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
const seriesWarmupTerms = 20
const epsilon = 1e-14
const minimumPositive = 1e-30
const addOne = Number.sum(1)
const subtractOne = Number.subtract(1)
const scaleByEpsilon = Number.multiply(epsilon)
const isBelowMinimumPositive = Number.lessThan(minimumPositive)
const isConverged = Number.lessThan(epsilon)
const exceedsIterationLimit = Number.greaterThan(maxIterations)

/** Clamp tiny values away from zero to prevent division overflow. */
const useMinimumPositive = (_value: number): number => minimumPositive
const selectGuard = Boolean.match({
  onTrue: () => useMinimumPositive,
  onFalse: () => Function.identity<number>
})
const guard = (value: number): number => selectGuard(isBelowMinimumPositive(abs(value)))(value)

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
  const ap1 = addOne(a)
  const term1 = Number.multiply(initial, Number.unsafeDivide(x, ap1))
  const sum1 = Number.sum(initial, term1)
  const ap2 = addOne(ap1)
  const term2 = Number.multiply(term1, Number.unsafeDivide(x, ap2))
  const sum2 = Number.sum(sum1, term2)
  const ap3 = addOne(ap2)
  const term3 = Number.multiply(term2, Number.unsafeDivide(x, ap3))
  const sum3 = Number.sum(sum2, term3)
  const ap4 = addOne(ap3)
  const term4 = Number.multiply(term3, Number.unsafeDivide(x, ap4))
  const sum4 = Number.sum(sum3, term4)
  const ap5 = addOne(ap4)
  const term5 = Number.multiply(term4, Number.unsafeDivide(x, ap5))
  const sum5 = Number.sum(sum4, term5)
  const ap6 = addOne(ap5)
  const term6 = Number.multiply(term5, Number.unsafeDivide(x, ap6))
  const sum6 = Number.sum(sum5, term6)
  const ap7 = addOne(ap6)
  const term7 = Number.multiply(term6, Number.unsafeDivide(x, ap7))
  const sum7 = Number.sum(sum6, term7)
  const ap8 = addOne(ap7)
  const term8 = Number.multiply(term7, Number.unsafeDivide(x, ap8))
  const sum8 = Number.sum(sum7, term8)
  const ap9 = addOne(ap8)
  const term9 = Number.multiply(term8, Number.unsafeDivide(x, ap9))
  const sum9 = Number.sum(sum8, term9)
  const ap10 = addOne(ap9)
  const term10 = Number.multiply(term9, Number.unsafeDivide(x, ap10))
  const sum10 = Number.sum(sum9, term10)
  const ap11 = addOne(ap10)
  const term11 = Number.multiply(term10, Number.unsafeDivide(x, ap11))
  const sum11 = Number.sum(sum10, term11)
  const ap12 = addOne(ap11)
  const term12 = Number.multiply(term11, Number.unsafeDivide(x, ap12))
  const sum12 = Number.sum(sum11, term12)
  const ap13 = addOne(ap12)
  const term13 = Number.multiply(term12, Number.unsafeDivide(x, ap13))
  const sum13 = Number.sum(sum12, term13)
  const ap14 = addOne(ap13)
  const term14 = Number.multiply(term13, Number.unsafeDivide(x, ap14))
  const sum14 = Number.sum(sum13, term14)
  const ap15 = addOne(ap14)
  const term15 = Number.multiply(term14, Number.unsafeDivide(x, ap15))
  const sum15 = Number.sum(sum14, term15)
  const ap16 = addOne(ap15)
  const term16 = Number.multiply(term15, Number.unsafeDivide(x, ap16))
  const sum16 = Number.sum(sum15, term16)
  const ap17 = addOne(ap16)
  const term17 = Number.multiply(term16, Number.unsafeDivide(x, ap17))
  const sum17 = Number.sum(sum16, term17)
  const ap18 = addOne(ap17)
  const term18 = Number.multiply(term17, Number.unsafeDivide(x, ap18))
  const sum18 = Number.sum(sum17, term18)
  const ap19 = addOne(ap18)
  const term19 = Number.multiply(term18, Number.unsafeDivide(x, ap19))
  const sum19 = Number.sum(sum18, term19)
  const ap20 = addOne(ap19)
  const term20 = Number.multiply(term19, Number.unsafeDivide(x, ap20))
  const sum20 = Number.sum(sum19, term20)
  const sum = gammaincSeriesLoop(x, ap20, term20, sum20, Number.subtract(maxIterations, seriesWarmupTerms))
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
): number => selectFractionLimit(exceedsIterationLimit(iteration))(a, x, f, c, d, iteration)

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
  return selectFractionConvergence(isConverged(abs(Number.subtract(delta, 1))))(
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
): number => gammaincCFLoop(a, x, f, c, d, addOne(iteration))

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
