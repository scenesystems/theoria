import { Match, Number as Num } from "effect"
import { exp, log1pStrict, logStrict } from "effect-math/Numeric"

import type { TruncatedNormalParams } from "./model.js"
import { StandardizedBounds } from "./model.js"
import { logDiff, logNdtr, logNormPdf, logSum, ndtr, ndtriExp } from "./normal.js"
import { isValidParams } from "./validation.js"

const clamp = (value: number, low: number, high: number): number =>
  Num.clamp(value, {
    minimum: low,
    maximum: high
  })

const standardizeBounds = (params: TruncatedNormalParams): StandardizedBounds =>
  new StandardizedBounds({
    a: Num.unsafeDivide(params.low - params.mean, params.sigma),
    b: Num.unsafeDivide(params.high - params.mean, params.sigma)
  })

const logGaussMass = (a: number, b: number): number => {
  const massCaseLeft = (left: number, right: number): number => logDiff(logNdtr(right), logNdtr(left))
  const massCaseRight = (left: number, right: number): number => massCaseLeft(-right, -left)
  const massCaseCentral = (left: number, right: number): number => log1pStrict(-ndtr(left) - ndtr(-right))

  return Match.value({ a, b }).pipe(
    Match.when(({ b: right }) => right <= 0, ({ a: left, b: right }) => massCaseLeft(left, right)),
    Match.when(({ a: left }) => left > 0, ({ a: left, b: right }) => massCaseRight(left, right)),
    Match.orElse(({ a: left, b: right }) => massCaseCentral(left, right))
  )
}

const LOG_MACHINE_EPSILON = logStrict(Number.EPSILON)

const ppfFinite = (q: number, a: number, b: number): number => {
  const logMass = logGaussMass(a, b)

  return Match.value(a).pipe(
    Match.when((left) => left < 0, (left) => {
      const logBase = logNdtr(left)
      const logIncrement = logStrict(q) + logMass
      const gap = logIncrement - logBase
      return Match.value(gap < LOG_MACHINE_EPSILON).pipe(
        Match.when(true, () => left),
        Match.orElse(() => ndtriExp(logSum(logBase, logIncrement)))
      )
    }),
    Match.orElse(() => {
      const logBase = logNdtr(-b)
      const logIncrement = log1pStrict(-q) + logMass
      const gap = logIncrement - logBase
      return Match.value(gap < LOG_MACHINE_EPSILON).pipe(
        Match.when(true, () => -(-b)),
        Match.orElse(() => -ndtriExp(logSum(logBase, logIncrement)))
      )
    })
  )
}

const ppf = (q: number, a: number, b: number): number =>
  Match.value({ q, a, b }).pipe(
    Match.when(({ q: quantile, a: left, b: right }) =>
      !Number.isFinite(quantile) || !Number.isFinite(left) || !Number.isFinite(right), () =>
      Number.NaN),
    Match.when(({ q: quantile, a: left, b: right }) =>
      left === right || quantile < 0 || quantile > 1, () => Number.NaN),
    Match.when(({ q: quantile }) => quantile === 0, ({ a: left }) => left),
    Match.when(({ q: quantile }) => quantile === 1, ({ b: right }) => right),
    Match.orElse(({ q: quantile, a: left, b: right }) => ppfFinite(quantile, left, right))
  )

export const logPdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value({ x, params }).pipe(
    Match.when(({ params: currentParams }) => !isValidParams(currentParams), () => Number.NaN),
    Match.when(({ x: currentX }) => Number.isNaN(currentX), () => Number.NaN),
    Match.orElse(({ x: currentX, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)

      return Match.value({ x: currentX, bounds }).pipe(
        Match.when(({ bounds: currentBounds }) => currentBounds.a === currentBounds.b, () => Number.NaN),
        Match.when(({ x: value }) => !Number.isFinite(value), () => Number.NEGATIVE_INFINITY),
        Match.orElse(() => {
          const standardized = Num.unsafeDivide(currentX - currentParams.mean, currentParams.sigma)

          return Match.value(standardized).pipe(
            Match.when((value) => value < bounds.a || value > bounds.b, () => Number.NEGATIVE_INFINITY),
            Match.orElse(() =>
              logNormPdf(standardized) - logGaussMass(bounds.a, bounds.b) - logStrict(currentParams.sigma)
            )
          )
        })
      )
    })
  )
}

export const cdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value({ x, params }).pipe(
    Match.when(({ params: currentParams }) => !isValidParams(currentParams), () => Number.NaN),
    Match.when(({ x: currentX }) => Number.isNaN(currentX), () => Number.NaN),
    Match.when(({ params: currentParams }) => currentParams.low === currentParams.high, () => Number.NaN),
    Match.when(({ x: currentX, params: currentParams }) => currentX <= currentParams.low, () => 0),
    Match.when(({ x: currentX, params: currentParams }) => currentX >= currentParams.high, () => 1),
    Match.orElse(({ x: currentX, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const standardized = Num.unsafeDivide(currentX - currentParams.mean, currentParams.sigma)
      const numerator = logGaussMass(bounds.a, standardized)
      const denominator = logGaussMass(bounds.a, bounds.b)
      const value = exp(numerator - denominator)

      return clamp(value, 0, 1)
    })
  )
}

export const sample = (random: number, params: TruncatedNormalParams): number =>
  Match.value({ random, params }).pipe(
    Match.when(
      ({ random: currentRandom, params: currentParams }) =>
        Number.isNaN(currentRandom) || !isValidParams(currentParams),
      () => Number.NaN
    ),
    Match.orElse(({ random: currentRandom, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const quantile = clamp(currentRandom, 0, 1)
      return Match.value(quantile).pipe(
        Match.when((currentQuantile) => currentQuantile <= 0, () => currentParams.low),
        Match.when((currentQuantile) => currentQuantile >= 1, () => currentParams.high),
        Match.orElse((currentQuantile) => {
          const standardized = ppf(currentQuantile, bounds.a, bounds.b)

          return Match.value(Number.isFinite(standardized)).pipe(
            Match.when(
              true,
              () =>
                clamp(
                  standardized * currentParams.sigma + currentParams.mean,
                  currentParams.low,
                  currentParams.high
                )
            ),
            Match.orElse(() =>
              Match.value(standardized === Number.NEGATIVE_INFINITY).pipe(
                Match.when(true, () => currentParams.low),
                Match.orElse(() =>
                  Match.value(standardized === Number.POSITIVE_INFINITY).pipe(
                    Match.when(true, () => currentParams.high),
                    Match.orElse(() => Number.NaN)
                  )
                )
              )
            )
          )
        })
      )
    })
  )
