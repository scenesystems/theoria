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
    a: Num.unsafeDivide(Num.subtract(params.low, params.mean), params.sigma),
    b: Num.unsafeDivide(Num.subtract(params.high, params.mean), params.sigma)
  })

const logGaussMass = (a: number, b: number): number => {
  const massCaseLeft = (left: number, right: number): number => logDiff(logNdtr(right), logNdtr(left))
  const massCaseRight = (left: number, right: number): number => massCaseLeft(Num.negate(right), Num.negate(left))
  const massCaseCentral = (left: number, right: number): number =>
    log1pStrict(Num.subtract(Num.negate(ndtr(left)), ndtr(Num.negate(right))))

  return Match.value({ a, b }).pipe(
    Match.when(({ b: right }) => Num.lessThanOrEqualTo(right, 0), ({ a: left, b: right }) => massCaseLeft(left, right)),
    Match.when(({ a: left }) => Num.greaterThan(left, 0), ({ a: left, b: right }) => massCaseRight(left, right)),
    Match.orElse(({ a: left, b: right }) => massCaseCentral(left, right))
  )
}

const logMachineEpsilon = logStrict(2.220446049250313e-16)

const ppfFinite = (q: number, a: number, b: number): number => {
  const logMass = logGaussMass(a, b)

  return Match.value(a).pipe(
    Match.when(Num.lessThan(0), (left) => {
      const logBase = logNdtr(left)
      const logIncrement = Num.sum(logStrict(q), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(Num.lessThan(gap, logMachineEpsilon)).pipe(
        Match.when(true, () => left),
        Match.orElse(() => ndtriExp(logSum(logBase, logIncrement)))
      )
    }),
    Match.orElse(() => {
      const logBase = logNdtr(Num.negate(b))
      const logIncrement = Num.sum(log1pStrict(Num.negate(q)), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(Num.lessThan(gap, logMachineEpsilon)).pipe(
        Match.when(true, () => b),
        Match.orElse(() => Num.negate(ndtriExp(logSum(logBase, logIncrement))))
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
        Bool.or(Num.lessThan(quantile, 0), Num.greaterThan(quantile, 1))
      ), () => Number.NaN),
    Match.when(({ q: quantile }) => Equal.equals(quantile, 0), ({ a: left }) => left),
    Match.when(({ q: quantile }) => Equal.equals(quantile, 1), ({ b: right }) => right),
    Match.orElse(({ q: quantile, a: left, b: right }) => ppfFinite(quantile, left, right))
  )

export const logPdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value({ x, params }).pipe(
    Match.when(({ params: currentParams }) => Bool.not(isValidParams(currentParams)), () => Number.NaN),
    Match.when(({ x: currentX }) => Predicate.not(Schema.is(Schema.NonNaN))(currentX), () => Number.NaN),
    Match.orElse(({ x: currentX, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)

      return Match.value({ x: currentX, bounds }).pipe(
        Match.when(({ bounds: currentBounds }) => Equal.equals(currentBounds.a, currentBounds.b), () => Number.NaN),
        Match.when(({ x: value }) => Bool.not(isFinite(value)), () => Number.NEGATIVE_INFINITY),
        Match.orElse(() => {
          const standardized = Num.unsafeDivide(Num.subtract(currentX, currentParams.mean), currentParams.sigma)

          return Match.value(standardized).pipe(
            Match.when(
              (value) => Bool.or(Num.lessThan(value, bounds.a), Num.greaterThan(value, bounds.b)),
              () => Number.NEGATIVE_INFINITY
            ),
            Match.orElse(() =>
              Num.subtract(
                Num.subtract(logNormPdf(standardized), logGaussMass(bounds.a, bounds.b)),
                logStrict(currentParams.sigma)
              )
            )
          )
        })
      )
    })
  )
}

export const cdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value({ x, params }).pipe(
    Match.when(({ params: currentParams }) => Bool.not(isValidParams(currentParams)), () => Number.NaN),
    Match.when(({ x: currentX }) => Predicate.not(Schema.is(Schema.NonNaN))(currentX), () => Number.NaN),
    Match.when(({ params: currentParams }) => Equal.equals(currentParams.low, currentParams.high), () => Number.NaN),
    Match.when(({ x: currentX, params: currentParams }) => Num.lessThanOrEqualTo(currentX, currentParams.low), () => 0),
    Match.when(
      ({ x: currentX, params: currentParams }) => Num.greaterThanOrEqualTo(currentX, currentParams.high),
      () => 1
    ),
    Match.orElse(({ x: currentX, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const standardized = Num.unsafeDivide(Num.subtract(currentX, currentParams.mean), currentParams.sigma)
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
        Bool.or(Predicate.not(Schema.is(Schema.NonNaN))(currentRandom), Bool.not(isValidParams(currentParams))),
      () => Number.NaN
    ),
    Match.orElse(({ random: currentRandom, params: currentParams }) => {
      const bounds = standardizeBounds(currentParams)
      const quantile = clamp(currentRandom, 0, 1)
      return Match.value(quantile).pipe(
        Match.when(Num.lessThanOrEqualTo(0), () => currentParams.low),
        Match.when(Num.greaterThanOrEqualTo(1), () => currentParams.high),
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
