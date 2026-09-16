import { Boolean, Equal, Match, Number as Num, Schema } from "effect"

import * as Float64 from "../../float64.js"
import type { TruncatedNormalParams } from "./model.js"
import { StandardizedBounds } from "./model.js"
import { logDiff, logNdtr, logNormPdf, logSum, ndtr, ndtriExp } from "./normal.js"
import { isValidParams } from "./validation.js"

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const isNaN = (value: number): boolean => Boolean.not(isNonNaN(value))

const lessThan = (left: number, right: number): boolean =>
  Boolean.and(Boolean.and(isNonNaN(left), isNonNaN(right)), Num.lessThan(left, right))

const lessThanOrEqualTo = (left: number, right: number): boolean =>
  Boolean.and(Boolean.and(isNonNaN(left), isNonNaN(right)), Num.lessThanOrEqualTo(left, right))

const greaterThan = (left: number, right: number): boolean =>
  Boolean.and(Boolean.and(isNonNaN(left), isNonNaN(right)), Num.greaterThan(left, right))

const greaterThanOrEqualTo = (left: number, right: number): boolean =>
  Boolean.and(Boolean.and(isNonNaN(left), isNonNaN(right)), Num.greaterThanOrEqualTo(left, right))

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
    Float64.log1p(Num.subtract(Num.negate(ndtr(left)), ndtr(Num.negate(right))))

  return Match.value(lessThanOrEqualTo(b, 0)).pipe(
    Match.when(true, () => massCaseLeft(a, b)),
    Match.orElse(() =>
      Match.value(greaterThan(a, 0)).pipe(
        Match.when(true, () => massCaseRight(a, b)),
        Match.orElse(() => massCaseCentral(a, b))
      )
    )
  )
}

const LOG_MACHINE_EPSILON = Float64.log(Number.EPSILON)

const ppfFinite = (q: number, a: number, b: number): number => {
  const logMass = logGaussMass(a, b)

  return Match.value(lessThan(a, 0)).pipe(
    Match.when(true, () => {
      const logBase = logNdtr(a)
      const logIncrement = Num.sum(Float64.log(q), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(lessThan(gap, LOG_MACHINE_EPSILON)).pipe(
        Match.when(true, () => a),
        Match.orElse(() => ndtriExp(logSum(logBase, logIncrement)))
      )
    }),
    Match.orElse(() => {
      const logBase = logNdtr(Num.negate(b))
      const logIncrement = Num.sum(Float64.log1p(Num.negate(q)), logMass)
      const gap = Num.subtract(logIncrement, logBase)
      return Match.value(lessThan(gap, LOG_MACHINE_EPSILON)).pipe(
        Match.when(true, () => Num.negate(Num.negate(b))),
        Match.orElse(() => Num.negate(ndtriExp(logSum(logBase, logIncrement))))
      )
    })
  )
}

const ppf = (q: number, a: number, b: number): number =>
  Match.value(
    Boolean.or(Boolean.not(isFinite(q)), Boolean.or(Boolean.not(isFinite(a)), Boolean.not(isFinite(b))))
  ).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() =>
      Match.value(
        Boolean.or(
          Equal.equals(a, b),
          Boolean.or(lessThan(q, 0), greaterThan(q, 1))
        )
      ).pipe(
        Match.when(true, () => Number.NaN),
        Match.orElse(() =>
          Match.value(q).pipe(
            Match.when((quantile) => Equal.equals(quantile, 0), () => a),
            Match.when((quantile) => Equal.equals(quantile, 1), () => b),
            Match.orElse((quantile) => ppfFinite(quantile, a, b))
          )
        )
      )
    )
  )

export const logPdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value(Boolean.or(Boolean.not(isValidParams(params)), isNaN(x))).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() => {
      const bounds = standardizeBounds(params)

      return Match.value(Equal.equals(bounds.a, bounds.b)).pipe(
        Match.when(true, () => Number.NaN),
        Match.orElse(() => {
          return Match.value(Boolean.not(isFinite(x))).pipe(
            Match.when(true, () => Number.NEGATIVE_INFINITY),
            Match.orElse(() => {
              const standardized = Num.unsafeDivide(Num.subtract(x, params.mean), params.sigma)

              return Match.value(Boolean.or(lessThan(standardized, bounds.a), greaterThan(standardized, bounds.b)))
                .pipe(
                  Match.when(true, () => Number.NEGATIVE_INFINITY),
                  Match.orElse(() =>
                    Num.subtract(
                      Num.subtract(logNormPdf(standardized), logGaussMass(bounds.a, bounds.b)),
                      Float64.log(params.sigma)
                    )
                  )
                )
            })
          )
        })
      )
    })
  )
}

export const cdf = (x: number, params: TruncatedNormalParams): number => {
  return Match.value(params).pipe(
    Match.when((currentParams) => Boolean.not(isValidParams(currentParams)), () => Number.NaN),
    Match.when(() => isNaN(x), () => Number.NaN),
    Match.when((currentParams) => Equal.equals(currentParams.low, currentParams.high), () => Number.NaN),
    Match.when((currentParams) => lessThanOrEqualTo(x, currentParams.low), () => 0),
    Match.when((currentParams) => greaterThanOrEqualTo(x, currentParams.high), () => 1),
    Match.orElse((currentParams) => {
      const bounds = standardizeBounds(currentParams)
      const standardized = Num.unsafeDivide(Num.subtract(x, currentParams.mean), currentParams.sigma)
      const numerator = logGaussMass(bounds.a, standardized)
      const denominator = logGaussMass(bounds.a, bounds.b)
      const value = Float64.exp(Num.subtract(numerator, denominator))

      return clamp(value, 0, 1)
    })
  )
}

export const sample = (random: number, params: TruncatedNormalParams): number =>
  Match.value(Boolean.or(isNaN(random), Boolean.not(isValidParams(params)))).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() => {
      const bounds = standardizeBounds(params)
      const quantile = clamp(random, 0, 1)
      return Match.value(quantile).pipe(
        Match.when((currentQuantile) => lessThanOrEqualTo(currentQuantile, 0), () => params.low),
        Match.when((currentQuantile) => greaterThanOrEqualTo(currentQuantile, 1), () => params.high),
        Match.orElse((currentQuantile) => {
          const standardized = ppf(currentQuantile, bounds.a, bounds.b)

          return Match.value(isFinite(standardized)).pipe(
            Match.when(
              true,
              () =>
                clamp(
                  Num.sum(Num.multiply(standardized, params.sigma), params.mean),
                  params.low,
                  params.high
                )
            ),
            Match.orElse(() =>
              Match.value(Equal.equals(standardized, Number.NEGATIVE_INFINITY)).pipe(
                Match.when(true, () => params.low),
                Match.orElse(() =>
                  Match.value(Equal.equals(standardized, Number.POSITIVE_INFINITY)).pipe(
                    Match.when(true, () => params.high),
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
