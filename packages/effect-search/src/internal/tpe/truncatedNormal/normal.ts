import { abs, expm1Strict, isFinite, log1pStrict, logaddexp, logStrict, sqrt } from "@scenesystems/effect-math/Numeric"
import { erf, erfc } from "@scenesystems/effect-math/Special"
import { Boolean as Bool, Equal, Match, Number as Num, Predicate, Schema } from "effect"

import { exp } from "../../exponential.js"
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

class AsymptoticSeriesState extends Schema.Class<AsymptoticSeriesState>("effect-search/AsymptoticSeriesState")({
  lastTotal: Schema.Number,
  rightHandSide: Schema.Number,
  numerator: Schema.Number,
  denominatorFactor: Schema.Number,
  denominatorConstant: Schema.Number,
  sign: Schema.Number,
  index: Schema.Number
}) {}

export const ndtr = (value: number): number => {
  const scaled = Num.unsafeDivide(value, sqrtTwo)

  return Match.value(scaled).pipe(
    Match.when(Num.lessThan(Num.negate(inverseSqrtTwo)), (current) => Num.multiply(0.5, erfc(Num.negate(current)))),
    Match.when(Num.lessThan(inverseSqrtTwo), (current) => Num.sum(0.5, Num.multiply(0.5, erf(current)))),
    Match.orElse((current) => Num.subtract(1, Num.multiply(0.5, erfc(current))))
  )
}

const asymptoticSeries = (state: AsymptoticSeriesState): number => {
  return Match.value(
    Bool.or(
      Num.lessThanOrEqualTo(abs(Num.subtract(state.lastTotal, state.rightHandSide)), machineEpsilon),
      Num.greaterThanOrEqualTo(state.index, 1_024)
    )
  ).pipe(
    Match.when(true, () => state.rightHandSide),
    Match.orElse(() => {
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
    })
  )
}

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

export const logNdtr = (value: number): number =>
  Match.value(value).pipe(
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

const newtonRefine = (targetLogNdtr: number, current: number, iteration: number): number => {
  return Match.value(Num.greaterThanOrEqualTo(iteration, newtonMaximumIterations)).pipe(
    Match.when(true, () => current),
    Match.orElse(() => {
      const logNdtrAtCurrent = logNdtr(current)
      const logNormPdfAtCurrent = logNormPdf(current)
      const delta = Num.multiply(
        Num.subtract(logNdtrAtCurrent, targetLogNdtr),
        exp(Num.subtract(logNdtrAtCurrent, logNormPdfAtCurrent))
      )
      const next = Num.subtract(current, delta)
      const tolerance = Num.multiply(newtonRelativeTolerance, Num.max(1, abs(next)))

      return Match.value(Num.lessThan(abs(delta), tolerance)).pipe(
        Match.when(true, () => next),
        Match.orElse(() => newtonRefine(targetLogNdtr, next, Num.increment(iteration)))
      )
    })
  )
}

const solveNdtriExp = (value: number): number => {
  const flipped = Num.greaterThan(value, ndtriExpFlipThreshold)
  const normalized = Match.value(flipped).pipe(
    Match.when(true, () => logStrict(Num.negate(expm1Strict(value)))),
    Match.orElse(() => value)
  )

  const initialGuess = Match.value(Num.lessThan(normalized, ndtriExpSwitch)).pipe(
    Match.when(true, () => Num.negate(sqrt(Num.multiply(Num.negate(2), Num.sum(normalized, logSqrtTwoPi))))),
    Match.orElse(() =>
      Num.multiply(Num.negate(ndtriExpApproximationFactor), logStrict(expm1Strict(Num.negate(normalized))))
    )
  )

  const solved = newtonRefine(normalized, initialGuess, 0)

  return Match.value(flipped).pipe(
    Match.when(true, () => Num.negate(solved)),
    Match.orElse(() => solved)
  )
}

export const ndtriExp = (value: number): number =>
  Match.value(value).pipe(
    Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
    Match.when((current) => Equal.equals(current, 0), () => Number.POSITIVE_INFINITY),
    Match.when((current) => Bool.not(isFinite(current)), () => Number.NaN),
    Match.orElse(solveNdtriExp)
  )
