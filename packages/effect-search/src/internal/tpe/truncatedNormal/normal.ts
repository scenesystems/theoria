import { logaddexp } from "@scenesystems/effect-math/Numeric"
import { erf, erfc } from "@scenesystems/effect-math/Special"
import { Boolean as Bool, Equal, Match, Number as Num } from "effect"

import * as Float64 from "../../float64.js"
import {
  INV_SQRT_TWO,
  LOG_NDTR_ASYMPTOTIC_THRESHOLD,
  LOG_NDTR_RIGHT_TAIL_THRESHOLD,
  LOG_SQRT_TWO_PI,
  NDTRI_EXP_APPROX_C,
  NDTRI_EXP_FLIP_THRESHOLD,
  NDTRI_EXP_SWITCH,
  NEWTON_MAX_ITERATIONS,
  NEWTON_RELATIVE_TOLERANCE,
  SQRT_TWO
} from "./constants.js"
import { AsymptoticSeriesState } from "./model.js"

export const ndtr = (value: number): number => {
  const scaled = Num.unsafeDivide(value, SQRT_TWO)

  return Match.value(scaled).pipe(
    Match.when(Num.lessThan(Num.negate(INV_SQRT_TWO)), (current) => Num.multiply(0.5, erfc(Num.negate(current)))),
    Match.when(Num.lessThan(INV_SQRT_TWO), (current) => Num.sum(0.5, Num.multiply(0.5, erf(current)))),
    Match.orElse((current) => Num.subtract(1, Num.multiply(0.5, erfc(current))))
  )
}

const asymptoticSeries = (state: AsymptoticSeriesState): number => {
  return Match.value(
    Bool.or(
      Num.lessThanOrEqualTo(Float64.abs(Num.subtract(state.lastTotal, state.rightHandSide)), Number.EPSILON),
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
    Num.subtract(Num.multiply(Num.multiply(-0.5, value), value), Float64.log(Num.negate(value))),
    LOG_SQRT_TWO_PI
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

  return Num.sum(logLeftHandSide, Float64.log(asymptoticRightHandSide))
}

export const logNdtr = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Number.isNaN, () => Number.NaN),
    Match.when((current) => Equal.equals(current, Number.NEGATIVE_INFINITY), () => Number.NEGATIVE_INFINITY),
    Match.when((current) => Equal.equals(current, Number.POSITIVE_INFINITY), () => 0),
    Match.when(Num.greaterThan(LOG_NDTR_RIGHT_TAIL_THRESHOLD), (current) => Num.negate(ndtr(Num.negate(current)))),
    Match.when(Num.greaterThan(LOG_NDTR_ASYMPTOTIC_THRESHOLD), (current) => Float64.log(ndtr(current))),
    Match.orElse(logNdtrAsymptotic)
  )

export const logNormPdf = (x: number): number => Num.subtract(Num.multiply(Num.multiply(-0.5, x), x), LOG_SQRT_TWO_PI)

export const logSum = (logP: number, logQ: number): number => logaddexp(logP, logQ)

export const logDiff = (logP: number, logQ: number): number =>
  Match.value(logP).pipe(
    Match.when(() => Equal.equals(logQ, Number.NEGATIVE_INFINITY), () => logP),
    Match.when(Num.lessThanOrEqualTo(logQ), () => Number.NEGATIVE_INFINITY),
    Match.orElse((current) => Num.sum(current, Float64.log1p(Num.negate(Float64.exp(Num.subtract(logQ, current))))))
  )

const newtonRefine = (targetLogNdtr: number, current: number, iteration: number): number => {
  return Match.value(Num.greaterThanOrEqualTo(iteration, NEWTON_MAX_ITERATIONS)).pipe(
    Match.when(true, () => current),
    Match.orElse(() => {
      const logNdtrAtCurrent = logNdtr(current)
      const logNormPdfAtCurrent = logNormPdf(current)
      const delta = Num.multiply(
        Num.subtract(logNdtrAtCurrent, targetLogNdtr),
        Float64.exp(Num.subtract(logNdtrAtCurrent, logNormPdfAtCurrent))
      )
      const next = Num.subtract(current, delta)
      const tolerance = Num.multiply(NEWTON_RELATIVE_TOLERANCE, Num.max(1, Float64.abs(next)))

      return Match.value(Num.lessThan(Float64.abs(delta), tolerance)).pipe(
        Match.when(true, () => next),
        Match.orElse(() => newtonRefine(targetLogNdtr, next, Num.increment(iteration)))
      )
    })
  )
}

const solveNdtriExp = (value: number): number => {
  const flipped = Num.greaterThan(value, NDTRI_EXP_FLIP_THRESHOLD)
  const normalized = Match.value(flipped).pipe(
    Match.when(true, () => Float64.log(Num.negate(Float64.expm1(value)))),
    Match.orElse(() => value)
  )

  const initialGuess = Match.value(Num.lessThan(normalized, NDTRI_EXP_SWITCH)).pipe(
    Match.when(true, () => Num.negate(Float64.sqrt(Num.multiply(-2, Num.sum(normalized, LOG_SQRT_TWO_PI))))),
    Match.orElse(() => Num.multiply(Num.negate(NDTRI_EXP_APPROX_C), Float64.log(Float64.expm1(Num.negate(normalized)))))
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
    Match.when((current) => Bool.not(Number.isFinite(current)), () => Number.NaN),
    Match.orElse(solveNdtriExp)
  )
