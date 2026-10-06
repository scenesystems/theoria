import { isFinite, log1pStrict, logStrict } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Equal, Match, Number as Num, Predicate, Schema } from "effect"

import { exp } from "../../exponential.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { logDiff, logNdtr, logNormPdf, logSum, ndtr, ndtriExp } from "./normal.js"
import { isValidParams } from "./validation.js"

class StandardizedBounds extends Schema.Class<StandardizedBounds>(
  "@scenesystems/effect-search/internal/tpe/truncatedNormal/truncated/StandardizedBounds"
)({
  a: Schema.Number,
  b: Schema.Number
}) {}

const clamp = (value: number, low: number, high: number): number =>
  Num.clamp(value, {
    minimum: low,
    maximum: high
  })

const standardizeBounds = (params: TruncatedNormalParams): StandardizedBounds =>
  new StandardizedBounds({
    a: Num.divideUnsafe(Num.subtract(params.low, params.mean), params.sigma),
    b: Num.divideUnsafe(Num.subtract(params.high, params.mean), params.sigma)
  })

export const logGaussMass = (a: number, b: number): number => {
  const massCaseLeft = (left: number, right: number): number => logDiff(logNdtr(right), logNdtr(left))
  const massCaseRight = (left: number, right: number): number =>
    massCaseLeft(Num.multiply(-1, right), Num.multiply(-1, left))
  const massCaseCentral = (left: number, right: number): number =>
    log1pStrict(Num.subtract(Num.multiply(-1, ndtr(left)), ndtr(Num.multiply(-1, right))))

  return Match.value({ a, b }).pipe(
    Match.when(
      ({ b: right }) => Num.isLessThanOrEqualTo(right, 0),
      ({ a: left, b: right }) => massCaseLeft(left, right)
    ),
    Match.when(({ a: left }) => Num.isGreaterThan(left, 0), ({ a: left, b: right }) => massCaseRight(left, right)),
    Match.orElse(({ a: left, b: right }) => massCaseCentral(left, right))
  )
}

const logMachineEpsilon = logStrict(2.220446049250313e-16)

const ppfFinite = (q: number, a: number, b: number): number => {
  const logMass = logGaussMass(a, b)

  return Match.value(a).pipe(
    Match.when(Num.isLessThan(0), (left) => {
      const logBase = logNdtr(left)
      const logIncrement = Num.sum(logStrict(q), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(Num.isLessThan(gap, logMachineEpsilon)).pipe(
        Match.when(true, () => left),
        Match.orElse(() => ndtriExp(logSum(logBase, logIncrement)))
      )
    }),
    Match.orElse(() => {
      const logBase = logNdtr(Num.multiply(-1, b))
      const logIncrement = Num.sum(log1pStrict(Num.multiply(-1, q)), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(Num.isLessThan(gap, logMachineEpsilon)).pipe(
        Match.when(true, () => b),
        Match.orElse(() => Num.multiply(-1, ndtriExp(logSum(logBase, logIncrement))))
      )
    })
  )
}

const ppf = (q: number, a: number, b: number): number =>
  Match.value({ q, a, b }).pipe(
    Match.when(({ q: quantile, a: left, b: right }) =>
      Bool.or(
        Bool.not(isFinite(quantile)),
        Bool.or(Bool.not(isFinite(left)), Bool.not(isFinite(right)))
      ), () => Number.NaN),
    Match.when(({ q: quantile, a: left, b: right }) =>
      Bool.or(
        Equal.equals(left, right),
        Bool.or(Num.isLessThan(quantile, 0), Num.isGreaterThan(quantile, 1))
      ), () => Number.NaN),
    Match.when(({ q: quantile }) => Equal.equals(quantile, 0), ({ a: left }) => left),
    Match.when(({ q: quantile }) => Equal.equals(quantile, 1), ({ b: right }) => right),
    Match.orElse(({ q: quantile, a: left, b: right }) => ppfFinite(quantile, left, right))
  )

const logPdfEvaluator = (
  params: TruncatedNormalParams,
  bounds: StandardizedBounds,
  normalize: (density: number) => number
): (x: number) => number =>
  Match.type<number>().pipe(
    Match.when((current) => Equal.equals(current, Number.NaN), () => Number.NaN),
    Match.when(() => Equal.equals(bounds.a, bounds.b), () => Number.NaN),
    Match.when(Predicate.not(isFinite), () => Number.NEGATIVE_INFINITY),
    Match.orElse((x) => {
      const standardized = Num.divideUnsafe(Num.subtract(x, params.mean), params.sigma)
      return Bool.match(Bool.or(Num.isLessThan(standardized, bounds.a), Num.isGreaterThan(standardized, bounds.b)), {
        onTrue: () => Number.NEGATIVE_INFINITY,
        onFalse: () => normalize(logNormPdf(standardized))
      })
    })
  )

export const logPdf = (x: number, params: TruncatedNormalParams): number =>
  Bool.match(isValidParams(params), {
    onFalse: () => Number.NaN,
    onTrue: () => {
      const bounds = standardizeBounds(params)
      // One-shot probes outside the support do not need normalization.
      return logPdfEvaluator(params, bounds, (density) =>
        Num.subtract(Num.subtract(density, logGaussMass(bounds.a, bounds.b)), logStrict(params.sigma)))(x)
    }
  })

/** Reuse only model-invariant arithmetic within a batch, preserving subtraction order. */
export const prepareLogPdf = (params: TruncatedNormalParams): (x: number) => number =>
  Bool.match(isValidParams(params), {
    onFalse: () => () => Number.NaN,
    onTrue: () => {
      const bounds = standardizeBounds(params)
      const logMass = logGaussMass(bounds.a, bounds.b)
      const logSigma = logStrict(params.sigma)
      return logPdfEvaluator(params, bounds, (density) => Num.subtract(Num.subtract(density, logMass), logSigma))
    }
  })

export const cdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value({ x, params }).pipe(
    Match.when(({ params: currentParams }) => Bool.not(isValidParams(currentParams)), () => Number.NaN),
    Match.when(({ x: currentX }) => Equal.equals(currentX, Number.NaN), () => Number.NaN),
    Match.when(({ params: currentParams }) => Equal.equals(currentParams.low, currentParams.high), () => Number.NaN),
    Match.when(
      ({ x: currentX, params: currentParams }) => Num.isLessThanOrEqualTo(currentX, currentParams.low),
      () => 0
    ),
    Match.when(
      ({ x: currentX, params: currentParams }) => Num.isGreaterThanOrEqualTo(currentX, currentParams.high),
      () => 1
    ),
    Match.orElse(({ x: currentX, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const standardized = Num.divideUnsafe(Num.subtract(currentX, currentParams.mean), currentParams.sigma)
      const numerator = logGaussMass(bounds.a, standardized)
      const denominator = logGaussMass(bounds.a, bounds.b)
      const value = exp(Num.subtract(numerator, denominator))

      return clamp(value, 0, 1)
    })
  )
}

export const sample = (random: number, params: TruncatedNormalParams): number =>
  Match.value({ random, params }).pipe(
    Match.when(
      ({ random: currentRandom, params: currentParams }) =>
        Bool.or(Equal.equals(currentRandom, Number.NaN), Bool.not(isValidParams(currentParams))),
      () => Number.NaN
    ),
    Match.orElse(({ random: currentRandom, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const quantile = clamp(currentRandom, 0, 1)
      return Match.value(quantile).pipe(
        Match.when(Num.isLessThanOrEqualTo(0), () => currentParams.low),
        Match.when(Num.isGreaterThanOrEqualTo(1), () => currentParams.high),
        Match.orElse((currentQuantile) => {
          const standardized = ppf(currentQuantile, bounds.a, bounds.b)

          return Match.value(isFinite(standardized)).pipe(
            Match.when(
              true,
              () =>
                clamp(
                  Num.sum(Num.multiply(standardized, currentParams.sigma), currentParams.mean),
                  currentParams.low,
                  currentParams.high
                )
            ),
            Match.orElse(() =>
              Match.value(Equal.equals(standardized, Number.NEGATIVE_INFINITY)).pipe(
                Match.when(true, () => currentParams.low),
                Match.orElse(() =>
                  Match.value(Equal.equals(standardized, Number.POSITIVE_INFINITY)).pipe(
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
