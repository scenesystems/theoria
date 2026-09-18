import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, FastCheck as fc, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { cdf, logPdf, sample, TruncatedNormalParams } from "../../../src/internal/tpe/truncatedNormal.js"

const paramsInputArbitrary = fc.record({
  mean: fc.double({
    min: Num.negate(5),
    max: 5,
    noNaN: true,
    noDefaultInfinity: true
  }),
  sigma: fc.double({
    min: 1e-3,
    max: 5,
    noNaN: true,
    noDefaultInfinity: true
  }),
  supportCenter: fc.double({
    min: Num.negate(8),
    max: 8,
    noNaN: true,
    noDefaultInfinity: true
  }),
  halfWidth: fc.double({
    min: 1e-3,
    max: 6,
    noNaN: true,
    noDefaultInfinity: true
  })
})

const quantileArbitrary = fc.double({
  min: 1e-300,
  max: Num.subtract(1, 1e-15),
  noNaN: true,
  noDefaultInfinity: true
})

const rollArbitrary = fc.double({
  min: Num.negate(2),
  max: 2,
  noNaN: true,
  noDefaultInfinity: true
})

const toParams = (input: {
  readonly mean: number
  readonly sigma: number
  readonly supportCenter: number
  readonly halfWidth: number
}): TruncatedNormalParams =>
  new TruncatedNormalParams({
    mean: input.mean,
    sigma: input.sigma,
    low: Num.subtract(input.supportCenter, input.halfWidth),
    high: Num.sum(input.supportCenter, input.halfWidth)
  })

// Endpoint-exact interpolation: `low + q * (high - low)` can land one ulp inside the support at q = 1,
// and far in a tail one ulp of x moves the cdf by more than CDF_EPSILON.
const supportPoint = (params: TruncatedNormalParams, quantile: number): number =>
  Num.sum(
    Num.multiply(params.low, Num.subtract(1, quantile)),
    Num.multiply(params.high, quantile)
  )

const CDF_EPSILON = 1e-8
const ROUNDTRIP_QUANTILE_TOLERANCE = 1e-7

// A floating-point quantile function is monotone up to the rounding of its output. `sample` returns
// `z * sigma + mean` with `z` accurate to a few ulps of max(1, |z|), so adjacent quantiles that the
// double representation cannot separate may come back in either order by about one ulp of
// `sigma + |mean| + max(|low|, |high|)`. Four ulps of that scale is the bound; the observed worst case
// over 2 × 10^5 generated parameter sets is 1.04.
const SAMPLE_MONOTONE_ULPS = 4

const sampleResolution = (params: TruncatedNormalParams): number =>
  Num.multiply(
    Num.multiply(SAMPLE_MONOTONE_ULPS, Number.EPSILON),
    Num.sum(
      Num.sum(params.sigma, Numeric.abs(params.mean)),
      Num.max(Numeric.abs(params.low), Numeric.abs(params.high))
    )
  )

const deterministicTailCases = Arr.make(
  {
    id: "mean-far-right-support-left",
    params: new TruncatedNormalParams({
      mean: 4,
      sigma: 0.8,
      low: Num.negate(1),
      high: Num.negate(0.3)
    })
  },
  {
    id: "mean-far-left-support-right",
    params: new TruncatedNormalParams({
      mean: Num.negate(4),
      sigma: 0.8,
      low: 0.3,
      high: 1
    })
  },
  {
    id: "ultra-right-tail",
    params: new TruncatedNormalParams({
      mean: 0,
      sigma: 1,
      low: 9,
      high: 12
    })
  },
  {
    id: "ultra-tight-support-far-right-mean",
    params: new TruncatedNormalParams({
      mean: 25,
      sigma: 2,
      low: Num.negate(0.02),
      high: 0.03
    })
  },
  {
    id: "ultra-tight-support-far-left-mean",
    params: new TruncatedNormalParams({
      mean: Num.negate(25),
      sigma: 2,
      low: Num.negate(0.03),
      high: 0.02
    })
  },
  {
    id: "micro-support-far-right-mean",
    params: new TruncatedNormalParams({
      mean: 40,
      sigma: 1.5,
      low: Num.negate(0.005),
      high: 0.004
    })
  },
  {
    id: "micro-support-far-left-mean",
    params: new TruncatedNormalParams({
      mean: Num.negate(40),
      sigma: 1.5,
      low: Num.negate(0.004),
      high: 0.005
    })
  },
  {
    id: "mean-near-low-bound-tiny-window",
    params: new TruncatedNormalParams({
      mean: 2.00005,
      sigma: 2e-4,
      low: 2,
      high: 2.0005
    })
  },
  {
    id: "mean-near-high-bound-tiny-window",
    params: new TruncatedNormalParams({
      mean: Num.negate(1.00005),
      sigma: 2e-4,
      low: Num.negate(1.0005),
      high: Num.negate(1)
    })
  }
)

const isMonotoneWithin = (values: Iterable<number>, tolerance: number): boolean => {
  const entries = Arr.fromIterable(values)
  return (
    Arr.every(
      entries,
      (value, index) =>
        Bool.or(
          Equal.equals(index, 0),
          Num.greaterThanOrEqualTo(
            Num.sum(value, tolerance),
            Arr.get(entries, Num.decrement(index)).pipe(
              Option.getOrElse(() => Number.NEGATIVE_INFINITY)
            )
          )
        )
    )
  )
}

const cdfTraceIsMonotone = (values: Iterable<number>): boolean => isMonotoneWithin(values, 0)

const valueAt = (values: Iterable<number>, index: number, fallback: number): number =>
  Arr.get(Arr.fromIterable(values), index).pipe(Option.getOrElse(() => fallback))

describe("truncated normal invariants", () => {
  it.effect("uses canonical signed-zero semantics for magnitude and square root", () =>
    Effect.sync(() => {
      const negativeZero = Num.negate(0)
      expect(Numeric.abs(negativeZero)).toBe(0)
      expect(Numeric.sqrt(negativeZero)).toBe(negativeZero)
    }))

  it.effect.prop(
    "cdf remains monotone and bounded on support",
    Tuple.make(paramsInputArbitrary),
    ([input]) =>
      Effect.sync(() => {
        const params = toParams(input)
        const points = Arr.makeBy(41, (index) => supportPoint(params, Num.unsafeDivide(index, 40)))
        const values = Arr.map(points, (point) => cdf(point, params))

        expect(Numeric.abs(Num.subtract(valueAt(values, 0, 0), 0))).toBeLessThanOrEqual(CDF_EPSILON)
        expect(Numeric.abs(Num.subtract(valueAt(values, Num.decrement(Arr.length(values)), 1), 1))).toBeLessThanOrEqual(
          CDF_EPSILON
        )
        expect(
          Arr.every(values, (value) =>
            Bool.and(
              Num.greaterThanOrEqualTo(value, Num.negate(CDF_EPSILON)),
              Num.lessThanOrEqualTo(value, Num.sum(1, CDF_EPSILON))
            ))
        ).toBe(true)
        expect(cdfTraceIsMonotone(values)).toBe(true)
      })
  )

  it.effect.prop(
    "sample values stay in [low, high] for all rolls",
    Tuple.make(
      paramsInputArbitrary,
      fc.array(rollArbitrary, { minLength: 1, maxLength: 128 })
    ),
    ([input, rolls]) =>
      Effect.sync(() => {
        const params = toParams(input)
        const draws = Arr.map(rolls, (roll) => sample(roll, params))

        expect(
          Arr.every(draws, (draw) =>
            Bool.and(Num.greaterThanOrEqualTo(draw, params.low), Num.lessThanOrEqualTo(draw, params.high)))
        ).toBe(true)
      })
  )

  it.effect.prop(
    "sample stays monotone as quantiles increase",
    Tuple.make(
      paramsInputArbitrary,
      fc.array(quantileArbitrary, { minLength: 2, maxLength: 128 })
    ),
    ([input, quantiles]) =>
      Effect.sync(() => {
        const params = toParams(input)
        const orderedQuantiles = Arr.sort(quantiles, Num.Order)
        const draws = Arr.map(orderedQuantiles, (quantile) => sample(quantile, params))

        expect(isMonotoneWithin(draws, sampleResolution(params))).toBe(true)
      })
  )

  it.effect.prop(
    "logPdf stays finite for points inside support",
    Tuple.make(
      paramsInputArbitrary,
      fc.array(quantileArbitrary, { minLength: 1, maxLength: 64 })
    ),
    ([input, quantiles]) =>
      Effect.sync(() => {
        const params = toParams(input)
        const probes = Arr.map(quantiles, (quantile) => supportPoint(params, quantile))

        expect(Arr.every(probes, (probe) => Numeric.isFinite(logPdf(probe, params)))).toBe(true)
      })
  )

  it.effect.prop(
    "cdf(sample(q)) round-trip remains stable across tail-heavy supports",
    Tuple.make(
      paramsInputArbitrary,
      fc.array(quantileArbitrary, { minLength: 1, maxLength: 64 })
    ),
    ([input, quantiles]) =>
      Effect.sync(() => {
        const params = toParams(input)
        const roundTripDiffs = Arr.map(quantiles, (quantile) => {
          const clampedQuantile = Num.clamp(quantile, {
            minimum: 0,
            maximum: 1
          })
          const sampleValue = sample(clampedQuantile, params)
          const recovered = cdf(sampleValue, params)

          return Numeric.abs(Num.subtract(recovered, clampedQuantile))
        })

        expect(Arr.every(roundTripDiffs, Num.lessThanOrEqualTo(ROUNDTRIP_QUANTILE_TOLERANCE))).toBe(true)
      })
  )

  it.effect.prop(
    "boundary contracts hold for cdf and sample",
    Tuple.make(paramsInputArbitrary),
    ([input]) =>
      Effect.sync(() => {
        const params = toParams(input)

        expect(Numeric.abs(Num.subtract(cdf(params.low, params), 0))).toBeLessThanOrEqual(CDF_EPSILON)
        expect(Numeric.abs(Num.subtract(cdf(params.high, params), 1))).toBeLessThanOrEqual(CDF_EPSILON)
        expect(Numeric.abs(Num.subtract(sample(0, params), params.low))).toBeLessThanOrEqual(1e-12)
        expect(Numeric.abs(Num.subtract(sample(1, params), params.high))).toBeLessThanOrEqual(1e-12)
      })
  )

  it.effect("deterministic tail cases preserve quantile round-trip and bounded samples", () =>
    Effect.forEach(
      deterministicTailCases,
      (tailCase) =>
        Effect.sync(() => {
          const quantiles = Arr.make(0, 0.01, 0.1, 0.5, 0.9, 0.99, 1)
          const draws = Arr.map(quantiles, (quantile) => sample(quantile, tailCase.params))
          const roundTripDiffs = Arr.map(quantiles, (quantile) => {
            const recovered = cdf(sample(quantile, tailCase.params), tailCase.params)
            return Numeric.abs(Num.subtract(recovered, quantile))
          })

          expect(
            Arr.every(draws, (draw) =>
              Bool.and(
                Num.greaterThanOrEqualTo(draw, tailCase.params.low),
                Num.lessThanOrEqualTo(draw, tailCase.params.high)
              ))
          ).toBe(true)
          expect(Arr.every(roundTripDiffs, Num.lessThanOrEqualTo(ROUNDTRIP_QUANTILE_TOLERANCE))).toBe(true)
        }),
      { discard: true }
    ))
})
