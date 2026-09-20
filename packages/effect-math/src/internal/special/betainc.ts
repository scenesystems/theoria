/**
 * Regularized incomplete beta function kernel.
 *
 * I_x(a,b) = B(x;a,b) / B(a,b) via a hypergeometric power series for
 * small b·x and the modified Lentz continued fraction (Lentz, 1976;
 * Thompson & Barnett, 1986) otherwise. Normalization uses log-space via
 * `lnGammaLanczos`.
 *
 * When x > (a+1)/(a+b+2) the symmetry identity I_x(a,b) = 1 − I_{1−x}(b,a)
 * is applied to ensure the continued fraction converges rapidly.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Function } from "effect"
import {
  Equivalence,
  greaterThan,
  greaterThanOrEqualTo,
  lessThan,
  lessThanOrEqualTo,
  multiply,
  negate,
  subtract,
  sum,
  unsafeDivide
} from "effect/Number"

import { abs, exp, log } from "../../Numeric.js"
import { lnGammaLanczos } from "./gamma.js"

const maxIterations = 200
const epsilon = 3e-14
const minimumPositive = 1e-30
const seriesProductLimit = 1.75
const addOne = sum(1)
const isConverged = lessThan(epsilon)
const reachedIterationLimit = greaterThanOrEqualTo(maxIterations)

/**
 * Log of B(a,b) = Γ(a)Γ(b)/Γ(a+b), shared by beta probabilities and densities.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogNorm = (a: number, b: number): number =>
  subtract(
    sum(lnGammaLanczos(a), lnGammaLanczos(b)),
    lnGammaLanczos(sum(a, b))
  )

const useMinimumPositive = Function.constant(minimumPositive)
const selectGuard = Boolean.match({
  onTrue: () => useMinimumPositive,
  onFalse: () => Function.identity<number>
})
const guard = (value: number): number => selectGuard(lessThan(abs(value), minimumPositive))(value)

/**
 * Modified Lentz continued fraction for I_x(a,b).
 *
 * Returns the CF value that, when multiplied by the beta-prefix / a,
 * gives I_x(a,b).
 *
 * @since 0.1.0
 * @category internal
 */
const betacf = (a: number, b: number, x: number): number => {
  const qab = sum(a, b)
  const qap = sum(a, 1)
  const qam = subtract(a, 1)

  const d0 = unsafeDivide(1, guard(subtract(1, unsafeDivide(multiply(qab, x), qap))))
  return fractionNext(a, b, x, qab, qap, qam, d0, 1, d0, 1)
}

/**
 * Lentz CF evaluation with scalar recurrence and bounded early termination.
 *
 * @since 0.1.0
 * @category internal
 */
const fractionNext = (
  a: number,
  b: number,
  x: number,
  qab: number,
  qap: number,
  qam: number,
  h: number,
  cPrev: number,
  dPrev: number,
  iteration: number
): number => {
  const twoM = multiply(2, iteration)
  const numEven = unsafeDivide(
    multiply(multiply(iteration, subtract(b, iteration)), x),
    multiply(sum(qam, twoM), sum(a, twoM))
  )
  const d1 = unsafeDivide(1, guard(sum(1, multiply(numEven, dPrev))))
  const c1 = guard(sum(1, unsafeDivide(numEven, cPrev)))
  const h1 = multiply(h, multiply(d1, c1))
  const numOdd = negate(
    unsafeDivide(
      multiply(multiply(sum(a, iteration), sum(qab, iteration)), x),
      multiply(sum(a, twoM), sum(qap, twoM))
    )
  )
  const d2 = unsafeDivide(1, guard(sum(1, multiply(numOdd, d1))))
  const c2 = guard(sum(1, unsafeDivide(numOdd, c1)))
  const delta = multiply(d2, c2)
  const hNext = multiply(h1, delta)
  return selectFractionStep(
    Boolean.or(isConverged(abs(subtract(delta, 1))), reachedIterationLimit(iteration))
  )(a, b, x, qab, qap, qam, hNext, c2, d2, iteration)
}

const fractionDone = (
  _a: number,
  _b: number,
  _x: number,
  _qab: number,
  _qap: number,
  _qam: number,
  h: number,
  _cPrev: number,
  _dPrev: number,
  _iteration: number
): number => h

const fractionContinue = (
  a: number,
  b: number,
  x: number,
  qab: number,
  qap: number,
  qam: number,
  h: number,
  cPrev: number,
  dPrev: number,
  iteration: number
): number => fractionNext(a, b, x, qab, qap, qam, h, cPrev, dPrev, addOne(iteration))

const selectFractionStep = Boolean.match({
  onTrue: () => fractionDone,
  onFalse: () => fractionContinue
})

const seriesNext = (
  a: number,
  b: number,
  x: number,
  term: number,
  value: number,
  total: number,
  inverseA: number,
  tolerance: number,
  iteration: number
): number =>
  selectSeriesStep(
    Boolean.or(
      lessThan(abs(value), tolerance),
      reachedIterationLimit(iteration)
    )
  )(a, b, x, term, value, total, inverseA, tolerance, iteration)

const seriesDone = (
  _a: number,
  _b: number,
  _x: number,
  _term: number,
  _value: number,
  total: number,
  inverseA: number,
  _tolerance: number,
  _iteration: number
): number => sum(total, inverseA)

const seriesContinue = (
  a: number,
  b: number,
  x: number,
  term: number,
  _value: number,
  total: number,
  inverseA: number,
  tolerance: number,
  iteration: number
): number => {
  const nextIteration = addOne(iteration)
  const firstRatio = unsafeDivide(multiply(subtract(iteration, b), x), iteration)
  const firstTerm = multiply(term, firstRatio)
  const firstValue = unsafeDivide(firstTerm, sum(a, iteration))
  const firstTotal = sum(total, firstValue)
  const secondRatio = unsafeDivide(multiply(subtract(nextIteration, b), x), nextIteration)
  const secondTerm = multiply(firstTerm, secondRatio)
  const secondValue = unsafeDivide(secondTerm, sum(a, nextIteration))
  return seriesNext(
    a,
    b,
    x,
    secondTerm,
    secondValue,
    sum(firstTotal, secondValue),
    inverseA,
    tolerance,
    addOne(nextIteration)
  )
}

const selectSeriesStep = Boolean.match({
  onTrue: () => seriesDone,
  onFalse: () => seriesContinue
})

const betaSeries = (a: number, b: number, x: number): number => {
  const inverseA = unsafeDivide(1, a)
  const term = multiply(subtract(1, b), x)
  const value = unsafeDivide(term, sum(a, 1))
  return seriesNext(a, b, x, term, value, value, inverseA, multiply(epsilon, inverseA), 2)
}

const betaincSeries = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number => {
  const lnPre = subtract(
    multiply(a, log(x)),
    logNormalization(a, b)
  )
  return multiply(exp(lnPre), betaSeries(a, b, x))
}

const betaincFraction = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number => {
  const lnPre = subtract(
    sum(
      multiply(a, log(x)),
      multiply(b, log(subtract(1, x)))
    ),
    sum(log(a), logNormalization(a, b))
  )
  return multiply(exp(lnPre), betacf(a, b, x))
}

const selectInteriorEvaluation = Boolean.match({
  onTrue: () => betaincSeries,
  onFalse: () => betaincFraction
})

const betaincDirect = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number =>
  // Bound the geometric tail as well as the initial term. Close to one,
  // small b·x can still require thousands of terms; use the fraction there.
  selectInteriorEvaluation(Boolean.and(
    lessThanOrEqualTo(x, 0.75),
    lessThanOrEqualTo(multiply(b, x), seriesProductLimit)
  ))(
    a,
    b,
    x,
    logNormalization
  )

const betaincReflected = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number => subtract(1, betaincDirect(b, a, subtract(1, x), logNormalization))

const selectSymmetry = Boolean.match({
  onTrue: () => betaincReflected,
  onFalse: () => betaincDirect
})

export const betaincInterior = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number =>
  selectSymmetry(
    greaterThan(x, unsafeDivide(sum(a, 1), sum(sum(a, b), 2)))
  )(a, b, x, logNormalization)

const betaincAtOne = (
  _a: number,
  _b: number,
  _x: number,
  _logNormalization: (a: number, b: number) => number
): number => 1

const selectOneEndpoint = Boolean.match({
  onTrue: () => betaincAtOne,
  onFalse: () => betaincInterior
})

const betaincAfterZero = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number
): number => selectOneEndpoint(Equivalence(x, 1))(a, b, x, logNormalization)

const betaincAtZero = (
  _a: number,
  _b: number,
  _x: number,
  _logNormalization: (a: number, b: number) => number
): number => 0

const selectZeroEndpoint = Boolean.match({
  onTrue: () => betaincAtZero,
  onFalse: () => betaincAfterZero
})

/**
 * Regularized incomplete beta I_x(a,b) = B(x;a,b) / B(a,b).
 *
 * Requires a > 0, b > 0, 0 ≤ x ≤ 1. Returns a value in [0, 1].
 * Internal inverse solves may supply their already computed log B(a,b).
 * Keep it lazy so one-shot endpoint calls do not evaluate normalization.
 *
 * @since 0.1.0
 * @category internal
 */
export const betainc = (
  a: number,
  b: number,
  x: number,
  logNormalization: (a: number, b: number) => number = betaLogNorm
): number => selectZeroEndpoint(Equivalence(x, 0))(a, b, x, logNormalization)
