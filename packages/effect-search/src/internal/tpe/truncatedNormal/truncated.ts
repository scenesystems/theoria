import { exp, isFinite, log1pStrict, logStrict } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Data, Equal, Match, Number as Num, Predicate, Schema } from "effect"

import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { logDiff, logNdtr, logNormPdf, logSum, ndtr, ndtriExp } from "./normal.js"
import { isValidParams } from "./validation.js"

class StandardizedBounds extends Data.Class<{
  readonly a: number
  readonly b: number
}> {}

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

// Only interior quantiles reach this evaluator. Bounds, mass and the tail base
// belong to the distribution; the Newton solve and its rounding stay unchanged.
const preparePpf = (a: number, b: number): (q: number) => number =>
  Bool.match(Bool.or(Bool.not(Bool.and(isFinite(a), isFinite(b))), Equal.equals(a, b)), {
    onTrue: () => () => Number.NaN,
    onFalse: () => {
      const logMass = logGaussMass(a, b)
      return Bool.match(Num.lessThan(a, 0), {
        onTrue: () => {
          const logBase = logNdtr(a)
          return (q) => {
            const logIncrement = Num.sum(logStrict(q), logMass)
            const gap = Num.subtract(logIncrement, logBase)
            return Bool.match(Num.lessThan(gap, logMachineEpsilon), {
              onTrue: () => a,
              onFalse: () => ndtriExp(logSum(logBase, logIncrement))
            })
          }
        },
        onFalse: () => {
          const logBase = logNdtr(Num.negate(b))
          return (q) => {
            const logIncrement = Num.sum(log1pStrict(Num.negate(q)), logMass)
            const gap = Num.subtract(logIncrement, logBase)
            return Bool.match(Num.lessThan(gap, logMachineEpsilon), {
              onTrue: () => b,
              onFalse: () => Num.negate(ndtriExp(logSum(logBase, logIncrement)))
            })
          }
        }
      })
    }
  })

const logPdfEvaluator = (
  params: TruncatedNormalParams,
  bounds: StandardizedBounds,
  normalize: (logPdf: number) => number
): (x: number) => number =>
  Bool.match(Equal.equals(bounds.a, bounds.b), {
    onTrue: () => () => Number.NaN,
    onFalse: () => (x) =>
      Bool.match(isFinite(x), {
        onFalse: () =>
          Bool.match(Num.Equivalence(x, x), {
            onTrue: () => Number.NEGATIVE_INFINITY,
            onFalse: () => Number.NaN
          }),
        onTrue: () => {
          const standardized = Num.unsafeDivide(Num.subtract(x, params.mean), params.sigma)
          return Bool.match(Bool.or(Num.lessThan(standardized, bounds.a), Num.greaterThan(standardized, bounds.b)), {
            onTrue: () => Number.NEGATIVE_INFINITY,
            onFalse: () => normalize(logNormPdf(standardized))
          })
        }
      })
  })

export const logPdf = (x: number, params: TruncatedNormalParams): number =>
  Bool.match(isValidParams(params), {
    onFalse: () => Number.NaN,
    onTrue: () => {
      const bounds = standardizeBounds(params)
      // Keep normalization lazy for one-shot probes outside the support.
      return logPdfEvaluator(params, bounds, (density) =>
        Num.subtract(Num.subtract(density, logGaussMass(bounds.a, bounds.b)), logStrict(params.sigma)))(x)
    }
  })

/** Prepare only model-invariant work; preserve the order of the two subtractions. */
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

const sampleEvaluator = (
  params: TruncatedNormalParams,
  quantile: (random: number) => number
): (random: number) => number =>
  Match.type<number>().pipe(
    Match.when((random) => Bool.not(Num.Equivalence(random, random)), () => Number.NaN),
    // Return the literal endpoints even if standardized bounds collapse.
    Match.when(Num.lessThanOrEqualTo(0), () => params.low),
    Match.when(Num.greaterThanOrEqualTo(1), () => params.high),
    Match.orElse((random) => {
      const standardized = quantile(random)
      return Bool.match(isFinite(standardized), {
        onTrue: () => clamp(Num.sum(Num.multiply(standardized, params.sigma), params.mean), params.low, params.high),
        onFalse: () =>
          Bool.match(Equal.equals(standardized, Number.NEGATIVE_INFINITY), {
            onTrue: () => params.low,
            onFalse: () =>
              Bool.match(Equal.equals(standardized, Number.POSITIVE_INFINITY), {
                onTrue: () => params.high,
                onFalse: () => Number.NaN
              })
          })
      })
    })
  )

/** Reuses distribution constants without caching random rolls or sampled values. */
export const prepareSample = (params: TruncatedNormalParams): (random: number) => number =>
  Bool.match(isValidParams(params), {
    onFalse: () => () => Number.NaN,
    onTrue: () => {
      const bounds = standardizeBounds(params)
      return sampleEvaluator(params, preparePpf(bounds.a, bounds.b))
    }
  })

export const sample = (random: number, params: TruncatedNormalParams): number =>
  Bool.match(isValidParams(params), {
    onFalse: () => Number.NaN,
    onTrue: () =>
      sampleEvaluator(params, (q) => {
        // One-shot endpoint rolls do not need the distribution's normalizer.
        const bounds = standardizeBounds(params)
        return preparePpf(bounds.a, bounds.b)(q)
      })(random)
  })
