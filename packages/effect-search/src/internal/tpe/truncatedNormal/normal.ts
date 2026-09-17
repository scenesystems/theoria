import {
  abs,
  exp,
  expm1Strict,
  isFinite,
  log1pStrict,
  logaddexp,
  logStrict,
  sqrt
} from "@scenesystems/effect-math/Numeric"
import { erf, erfc } from "@scenesystems/effect-math/Special"
import { Boolean as Bool, Data, Equal, Match, Number as Num, Predicate, Schema } from "effect"

import {
  inverseSqrtTwo,
  logNdtrAsymptoticThreshold,
  logNdtrRightTailThreshold,
  logSqrtTwoPi,
  ndtriExpApproximationFactor,
  ndtriExpFlipThreshold,
  ndtriExpSwitch,
  newtonMaximumIterations,
  newtonRelativeTolerance,
  sqrtTwo
} from "./constants.js"

const machineEpsilon = 2.220446049250313e-16

class AsymptoticSeriesState extends Data.Class<{
  readonly lastTotal: number
  readonly rightHandSide: number
  readonly numerator: number
  readonly denominatorFactor: number
  readonly denominatorConstant: number
  readonly sign: number
  readonly index: number
}> {}

const ndtrScaled = Match.type<number>().pipe(
  Match.when(Num.lessThan(Num.negate(inverseSqrtTwo)), (current) => Num.multiply(0.5, erfc(Num.negate(current)))),
  Match.when(Num.lessThan(inverseSqrtTwo), (current) => Num.sum(0.5, Num.multiply(0.5, erf(current)))),
  Match.orElse((current) => Num.subtract(1, Num.multiply(0.5, erfc(current))))
)

export const ndtr = (value: number): number => ndtrScaled(Num.unsafeDivide(value, sqrtTwo))

const asymptoticSeries = (state: AsymptoticSeriesState): number =>
  Bool.match(
    Bool.or(
      Num.lessThanOrEqualTo(abs(Num.subtract(state.lastTotal, state.rightHandSide)), machineEpsilon),
      Num.greaterThanOrEqualTo(state.index, 1_024)
    ),
    {
      onTrue: () => state.rightHandSide,
      onFalse: () => {
        const nextIndex = Num.increment(state.index)
        const nextSign = Num.negate(state.sign)
        const nextDenominatorFactor = Num.multiply(state.denominatorFactor, state.denominatorConstant)
        const nextNumerator = Num.multiply(state.numerator, Num.decrement(Num.multiply(2, nextIndex)))
        const nextRightHandSide = Num.sum(
          state.rightHandSide,
          Num.multiply(Num.multiply(nextSign, nextNumerator), nextDenominatorFactor)
        )

        return asymptoticSeries(
          new AsymptoticSeriesState({
            lastTotal: state.rightHandSide,
            rightHandSide: nextRightHandSide,
            numerator: nextNumerator,
            denominatorFactor: nextDenominatorFactor,
            denominatorConstant: state.denominatorConstant,
            sign: nextSign,
            index: nextIndex
          })
        )
      }
    }
  )

const logNdtrAsymptotic = (value: number): number => {
  const logLeftHandSide = Num.subtract(
    Num.subtract(Num.multiply(Num.multiply(Num.negate(0.5), value), value), logStrict(Num.negate(value))),
    logSqrtTwoPi
  )
  const asymptoticRightHandSide = asymptoticSeries(
    new AsymptoticSeriesState({
      lastTotal: 0,
      rightHandSide: 1,
      numerator: 1,
      denominatorFactor: 1,
      denominatorConstant: Num.unsafeDivide(1, Num.multiply(value, value)),
      sign: 1,
      index: 0
    })
  )

  return Num.sum(logLeftHandSide, logStrict(asymptoticRightHandSide))
}

export const logNdtr = Match.type<number>().pipe(
  Match.when(Predicate.not(Schema.is(Schema.NonNaN)), () => Number.NaN),
  Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
  Match.when((current) => Equal.equals(current, Number.POSITIVE_INFINITY), () => 0),
  Match.when(Num.greaterThan(logNdtrRightTailThreshold), (current) => Num.negate(ndtr(Num.negate(current)))),
  Match.when(Num.greaterThan(logNdtrAsymptoticThreshold), (current) => logStrict(ndtr(current))),
  Match.orElse(logNdtrAsymptotic)
)

export const logNormPdf = (x: number): number =>
  Num.subtract(Num.multiply(Num.multiply(Num.negate(0.5), x), x), logSqrtTwoPi)

export const logSum = (logP: number, logQ: number): number => logaddexp(logP, logQ)

export const logDiff = (logP: number, logQ: number): number =>
  Match.value(logP).pipe(
    Match.when(() => Equal.equals(logQ, Number.NEGATIVE_INFINITY), () => logP),
    Match.when(Num.lessThanOrEqualTo(logQ), () => Number.NEGATIVE_INFINITY),
    Match.orElse((current) => Num.sum(current, log1pStrict(Num.negate(exp(Num.subtract(logQ, current))))))
  )

const newtonRefine = (targetLogNdtr: number, current: number, iteration: number): number =>
  Bool.match(Num.greaterThanOrEqualTo(iteration, newtonMaximumIterations), {
    onTrue: () => current,
    onFalse: () => {
      const logNdtrAtCurrent = logNdtr(current)
      const logNormPdfAtCurrent = logNormPdf(current)
      const delta = Num.multiply(
        Num.subtract(logNdtrAtCurrent, targetLogNdtr),
        exp(Num.subtract(logNdtrAtCurrent, logNormPdfAtCurrent))
      )
      const next = Num.subtract(current, delta)
      const tolerance = Num.multiply(newtonRelativeTolerance, Num.max(1, abs(next)))

      return Bool.match(Num.lessThan(abs(delta), tolerance), {
        onTrue: () => next,
        onFalse: () => newtonRefine(targetLogNdtr, next, Num.increment(iteration))
      })
    }
  })

const solveNdtriExp = (value: number): number => {
  const flipped = Num.greaterThan(value, ndtriExpFlipThreshold)
  const normalized = Bool.match(flipped, {
    onTrue: () => logStrict(Num.negate(expm1Strict(value))),
    onFalse: () => value
  })

  const initialGuess = Bool.match(Num.lessThan(normalized, ndtriExpSwitch), {
    onTrue: () => Num.negate(sqrt(Num.multiply(Num.negate(2), Num.sum(normalized, logSqrtTwoPi)))),
    onFalse: () => Num.multiply(Num.negate(ndtriExpApproximationFactor), logStrict(expm1Strict(Num.negate(normalized))))
  })

  const solved = newtonRefine(normalized, initialGuess, 0)

  return Bool.match(flipped, {
    onTrue: () => Num.negate(solved),
    onFalse: () => solved
  })
}

export const ndtriExp = Match.type<number>().pipe(
  Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
  Match.when((current) => Equal.equals(current, 0), () => Number.POSITIVE_INFINITY),
  Match.when((current) => Bool.not(isFinite(current)), () => Number.NaN),
  Match.orElse(solveNdtriExp)
)
