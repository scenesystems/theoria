import { Match, Number as Num } from "effect"
import { logaddexp } from "effect-math/Numeric"
import { erf, erfc } from "effect-math/Special"

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
    Match.when((current) => current < -INV_SQRT_TWO, (current) => 0.5 * erfc(-current)),
    Match.when((current) => current < INV_SQRT_TWO, (current) => 0.5 + 0.5 * erf(current)),
    Match.orElse((current) => 1 - 0.5 * erfc(current))
  )
}

const asymptoticSeries = (state: AsymptoticSeriesState): number => {
  return Match.value(
    Float64.abs(state.lastTotal - state.rightHandSide) <= Number.EPSILON || state.index >= 1_024
  ).pipe(
    Match.when(true, () => state.rightHandSide),
    Match.orElse(() => {
      const nextIndex = state.index + 1
      const nextSign = -state.sign
      const nextDenominatorFactor = state.denominatorFactor * state.denominatorConstant
      const nextNumerator = state.numerator * (2 * nextIndex - 1)
      const nextRightHandSide = state.rightHandSide + nextSign * nextNumerator * nextDenominatorFactor

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
  const logLeftHandSide = -0.5 * value * value - Float64.log(-value) - LOG_SQRT_TWO_PI
  const asymptoticRightHandSide = asymptoticSeries(
    new AsymptoticSeriesState({
      lastTotal: 0,
      rightHandSide: 1,
      numerator: 1,
      denominatorFactor: 1,
      denominatorConstant: Num.unsafeDivide(1, value * value),
      sign: 1,
      index: 0
    })
  )

  return logLeftHandSide + Float64.log(asymptoticRightHandSide)
}

export const logNdtr = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Number.isNaN, () => Number.NaN),
    Match.when((current) => current == Number.NEGATIVE_INFINITY, () => Number.NEGATIVE_INFINITY),
    Match.when((current) => current == Number.POSITIVE_INFINITY, () => 0),
    Match.when((current) => current > LOG_NDTR_RIGHT_TAIL_THRESHOLD, (current) => -ndtr(-current)),
    Match.when((current) => current > LOG_NDTR_ASYMPTOTIC_THRESHOLD, (current) => Float64.log(ndtr(current))),
    Match.orElse(logNdtrAsymptotic)
  )

export const logNormPdf = (x: number): number => -0.5 * x * x - LOG_SQRT_TWO_PI

export const logSum = (logP: number, logQ: number): number => logaddexp(logP, logQ)

export const logDiff = (logP: number, logQ: number): number =>
  Match.value(logP).pipe(
    Match.when(() => logQ === Number.NEGATIVE_INFINITY, () => logP),
    Match.when((current) => current <= logQ, () => Number.NEGATIVE_INFINITY),
    Match.orElse((current) => current + Float64.log1p(-Float64.exp(logQ - current)))
  )

const newtonRefine = (targetLogNdtr: number, current: number, iteration: number): number => {
  return Match.value(iteration >= NEWTON_MAX_ITERATIONS).pipe(
    Match.when(true, () => current),
    Match.orElse(() => {
      const logNdtrAtCurrent = logNdtr(current)
      const logNormPdfAtCurrent = logNormPdf(current)
      const delta = (logNdtrAtCurrent - targetLogNdtr) * Float64.exp(logNdtrAtCurrent - logNormPdfAtCurrent)
      const next = current - delta
      const tolerance = NEWTON_RELATIVE_TOLERANCE * Num.max(1, Float64.abs(next))

      return Match.value(Float64.abs(delta) < tolerance).pipe(
        Match.when(true, () => next),
        Match.orElse(() => newtonRefine(targetLogNdtr, next, iteration + 1))
      )
    })
  )
}

const solveNdtriExp = (value: number): number => {
  const flipped = value > NDTRI_EXP_FLIP_THRESHOLD
  const normalized = flipped ? Float64.log(-Float64.expm1(value)) : value

  const initialGuess = Match.value(normalized < NDTRI_EXP_SWITCH).pipe(
    Match.when(true, () => -Float64.sqrt(-2 * (normalized + LOG_SQRT_TWO_PI))),
    Match.orElse(() => -NDTRI_EXP_APPROX_C * Float64.log(Float64.expm1(-normalized)))
  )

  const solved = newtonRefine(normalized, initialGuess, 0)

  return Match.value(flipped).pipe(
    Match.when(true, () => -solved),
    Match.orElse(() => solved)
  )
}

export const ndtriExp = (value: number): number =>
  Match.value(value).pipe(
    Match.when((current) => current == Number.NEGATIVE_INFINITY, () => Number.NEGATIVE_INFINITY),
    Match.when((current) => current == 0, () => Number.POSITIVE_INFINITY),
    Match.when((current) => !Number.isFinite(current), () => Number.NaN),
    Match.orElse(solveNdtriExp)
  )
