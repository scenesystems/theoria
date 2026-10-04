import { abs, expm1Strict, isFinite, log1pStrict, logaddexp, logStrict, sqrt } from "@scenesystems/effect-math/Numeric"
import { erf, erfc } from "@scenesystems/effect-math/Special"
import { Boolean as Bool, Equal, Match, Number as Num, Schema } from "effect"

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

class AsymptoticSeriesState extends Schema.Class<AsymptoticSeriesState>(
  "@scenesystems/effect-search/internal/tpe/truncatedNormal/normal/AsymptoticSeriesState"
)({
  lastTotal: Schema.Number,
  rightHandSide: Schema.Number,
  numerator: Schema.Number,
  denominatorFactor: Schema.Number,
  denominatorConstant: Schema.Number,
  sign: Schema.Number,
  index: Schema.Finite
}) {}

export const ndtr = (value: number): number => {
  const scaled = Num.divideUnsafe(value, sqrtTwo)

  return Match.value(scaled).pipe(
    Match.when(
      Num.isLessThan(Num.multiply(-1, inverseSqrtTwo)),
      (current) => Num.multiply(0.5, erfc(Num.multiply(-1, current)))
    ),
    Match.when(Num.isLessThan(inverseSqrtTwo), (current) => Num.sum(0.5, Num.multiply(0.5, erf(current)))),
    Match.orElse((current) => Num.subtract(1, Num.multiply(0.5, erfc(current))))
  )
}

const asymptoticSeries = (state: AsymptoticSeriesState): number => {
  return Match.value(
    Bool.or(
      Num.isLessThanOrEqualTo(abs(Num.subtract(state.lastTotal, state.rightHandSide)), machineEpsilon),
      Num.isGreaterThanOrEqualTo(state.index, 1_024)
    )
  ).pipe(
    Match.when(true, () => state.rightHandSide),
    Match.orElse(() => {
      const nextIndex = Num.increment(state.index)
      const nextSign = Num.multiply(-1, state.sign)
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
    Num.subtract(Num.multiply(Num.multiply(Num.multiply(-1, 0.5), value), value), logStrict(Num.multiply(-1, value))),
    logSqrtTwoPi
  )
  const asymptoticRightHandSide = asymptoticSeries(
    new AsymptoticSeriesState({
      lastTotal: 0,
      rightHandSide: 1,
      numerator: 1,
      denominatorFactor: 1,
      denominatorConstant: Num.divideUnsafe(1, Num.multiply(value, value)),
      sign: 1,
      index: 0
    })
  )

  return Num.sum(logLeftHandSide, logStrict(asymptoticRightHandSide))
}

export const logNdtr = (value: number): number =>
  Match.value(value).pipe(
    Match.when((current) => Equal.equals(current, Number.NaN), () => Number.NaN),
    Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
    Match.when((current) => Equal.equals(current, Number.POSITIVE_INFINITY), () => 0),
    Match.when(Num.isGreaterThan(logNdtrRightTailThreshold), (current) =>
      Num.multiply(-1, ndtr(Num.multiply(-1, current)))),
    Match.when(Num.isGreaterThan(logNdtrAsymptoticThreshold), (current) =>
      logStrict(ndtr(current))),
    Match.orElse(logNdtrAsymptotic)
  )

export const logNormPdf = (x: number): number =>
  Num.subtract(Num.multiply(Num.multiply(Num.multiply(-1, 0.5), x), x), logSqrtTwoPi)

export const logSum = (logP: number, logQ: number): number => logaddexp(logP, logQ)

export const logDiff = (logP: number, logQ: number): number =>
  Match.value(logP).pipe(
    Match.when(() => Equal.equals(logQ, Number.NEGATIVE_INFINITY), () => logP),
    Match.when(Num.isLessThanOrEqualTo(logQ), () => Number.NEGATIVE_INFINITY),
    Match.orElse((current) => Num.sum(current, log1pStrict(Num.multiply(-1, exp(Num.subtract(logQ, current))))))
  )

const newtonRefine = (targetLogNdtr: number, current: number, iteration: number): number => {
  return Match.value(Num.isGreaterThanOrEqualTo(iteration, newtonMaximumIterations)).pipe(
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

      return Match.value(Num.isLessThan(abs(delta), tolerance)).pipe(
        Match.when(true, () => next),
        Match.orElse(() => newtonRefine(targetLogNdtr, next, Num.increment(iteration)))
      )
    })
  )
}

const solveNdtriExp = (value: number): number => {
  const flipped = Num.isGreaterThan(value, ndtriExpFlipThreshold)
  const normalized = Match.value(flipped).pipe(
    Match.when(true, () => logStrict(Num.multiply(-1, expm1Strict(value)))),
    Match.orElse(() => value)
  )

  const initialGuess = Match.value(Num.isLessThan(normalized, ndtriExpSwitch)).pipe(
    Match.when(
      true,
      () => Num.multiply(-1, sqrt(Num.multiply(Num.multiply(-1, 2), Num.sum(normalized, logSqrtTwoPi))))
    ),
    Match.orElse(() =>
      Num.multiply(Num.multiply(-1, ndtriExpApproximationFactor), logStrict(expm1Strict(Num.multiply(-1, normalized))))
    )
  )

  const solved = newtonRefine(normalized, initialGuess, 0)

  return Match.value(flipped).pipe(
    Match.when(true, () => Num.multiply(-1, solved)),
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
