import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"
import fc from "fast-check"

import * as Float64 from "../../src/internal/float64.js"
import { cdf, logPdf, sample, TruncatedNormalParams } from "../../src/internal/tpe/truncatedNormal.js"

// eslint-disable-next-line no-restricted-syntax
type ParamsInput = {
  readonly mean: number
  readonly sigma: number
  readonly supportCenter: number
  readonly halfWidth: number
}

// eslint-disable-next-line no-restricted-syntax
type DeterministicTailCase = {
  readonly id: string
  readonly params: TruncatedNormalParams
}

const paramsInputArbitrary = fc.record({
  mean: fc.double({
    min: -5,
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
    min: -8,
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
  max: 1 - 1e-15,
  noNaN: true,
  noDefaultInfinity: true
})

const rollArbitrary = fc.double({
  min: -2,
  max: 2,
  noNaN: true,
  noDefaultInfinity: true
})

const toParams = (input: ParamsInput): TruncatedNormalParams =>
  new TruncatedNormalParams({
    mean: input.mean,
    sigma: input.sigma,
    low: input.supportCenter - input.halfWidth,
    high: input.supportCenter + input.halfWidth
  })

const supportPoint = (params: TruncatedNormalParams, quantile: number): number =>
  params.low + quantile * (params.high - params.low)

const CDF_EPSILON = 1e-8
const ROUNDTRIP_QUANTILE_TOLERANCE = 1e-7
const PPF_MONOTONE_RESOLUTION = 134 * Number.EPSILON

const deterministicTailCases: ReadonlyArray<DeterministicTailCase> = [
  {
    id: "mean-far-right-support-left",
    params: new TruncatedNormalParams({
      mean: 4,
      sigma: 0.8,
      low: -1,
      high: -0.3
    })
  },
  {
    id: "mean-far-left-support-right",
    params: new TruncatedNormalParams({
      mean: -4,
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
      low: -0.02,
      high: 0.03
    })
  },
  {
    id: "ultra-tight-support-far-left-mean",
    params: new TruncatedNormalParams({
      mean: -25,
      sigma: 2,
      low: -0.03,
      high: 0.02
    })
  },
  {
    id: "micro-support-far-right-mean",
    params: new TruncatedNormalParams({
      mean: 40,
      sigma: 1.5,
      low: -0.005,
      high: 0.004
    })
  },
  {
    id: "micro-support-far-left-mean",
    params: new TruncatedNormalParams({
      mean: -40,
      sigma: 1.5,
      low: -0.004,
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
      mean: -1.00005,
      sigma: 2e-4,
      low: -1.0005,
      high: -1
    })
  }
]

const cdfTraceIsMonotone = (values: ReadonlyArray<number>): boolean =>
  Arr.every(
    values,
    (value, index) =>
      index === 0 ||
      value >=
        Arr.get(values, index - 1).pipe(
          Option.getOrElse(() => Number.NEGATIVE_INFINITY)
        )
  )

const valueAt = (values: ReadonlyArray<number>, index: number, fallback: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

describe("truncated normal invariants", () => {
  it.effect("cdf remains monotone and bounded on support", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(paramsInputArbitrary, (input) => {
          const params = toParams(input)
          const points = Arr.makeBy(41, (index) => supportPoint(params, Num.unsafeDivide(index, 40)))
          const values = Arr.map(points, (point) => cdf(point, params))

          expect(Float64.abs(valueAt(values, 0, 0) - 0)).toBeLessThanOrEqual(CDF_EPSILON)
          expect(Float64.abs(valueAt(values, values.length - 1, 1) - 1)).toBeLessThanOrEqual(CDF_EPSILON)
          expect(Arr.every(values, (value) => value >= -CDF_EPSILON && value <= 1 + CDF_EPSILON)).toBe(true)
          expect(cdfTraceIsMonotone(values)).toBe(true)
        })
      )
    }))

  it.effect("sample values stay in [low, high] for all rolls", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(paramsInputArbitrary, fc.array(rollArbitrary, { minLength: 1, maxLength: 128 }), (input, rolls) => {
          const params = toParams(input)
          const draws = Arr.map(rolls, (roll) => sample(roll, params))

          expect(Arr.every(draws, (draw) => draw >= params.low && draw <= params.high)).toBe(true)
        })
      )
    }))

  it.effect("sample stays monotone as quantiles increase", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          paramsInputArbitrary,
          fc.array(quantileArbitrary, { minLength: 2, maxLength: 128 }),
          (input, quantiles) => {
            const params = toParams(input)
            const orderedQuantiles = Arr.sort(quantiles, Num.Order)
            const deduped = Arr.dedupeWith(orderedQuantiles, (a, b) => Float64.abs(a - b) < PPF_MONOTONE_RESOLUTION)
            const draws = Arr.map(deduped, (quantile) => sample(quantile, params))

            expect(cdfTraceIsMonotone(draws)).toBe(true)
          }
        )
      )
    }))

  it.effect("logPdf stays finite for points inside support", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          paramsInputArbitrary,
          fc.array(quantileArbitrary, { minLength: 1, maxLength: 64 }),
          (input, quantiles) => {
            const params = toParams(input)
            const probes = Arr.map(quantiles, (quantile) => supportPoint(params, quantile))

            expect(Arr.every(probes, (probe) => Number.isFinite(logPdf(probe, params)))).toBe(true)
          }
        )
      )
    }))

  it.effect("cdf(sample(q)) round-trip remains stable across tail-heavy supports", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          paramsInputArbitrary,
          fc.array(quantileArbitrary, { minLength: 1, maxLength: 64 }),
          (input, quantiles) => {
            const params = toParams(input)
            const roundTripDiffs = Arr.map(quantiles, (quantile) => {
              const clampedQuantile = Num.clamp(quantile, {
                minimum: 0,
                maximum: 1
              })
              const sampleValue = sample(clampedQuantile, params)
              const recovered = cdf(sampleValue, params)

              return Float64.abs(recovered - clampedQuantile)
            })

            expect(Arr.every(roundTripDiffs, (diff) => diff <= ROUNDTRIP_QUANTILE_TOLERANCE)).toBe(true)
          }
        )
      )
    }))

  it.effect("boundary contracts hold for cdf and sample", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(paramsInputArbitrary, (input) => {
          const params = toParams(input)

          expect(Float64.abs(cdf(params.low, params) - 0)).toBeLessThanOrEqual(CDF_EPSILON)
          expect(Float64.abs(cdf(params.high, params) - 1)).toBeLessThanOrEqual(CDF_EPSILON)
          expect(Float64.abs(sample(0, params) - params.low)).toBeLessThanOrEqual(1e-12)
          expect(Float64.abs(sample(1, params) - params.high)).toBeLessThanOrEqual(1e-12)
        })
      )
    }))

  it.effect("deterministic tail cases preserve quantile round-trip and bounded samples", () =>
    Effect.forEach(
      deterministicTailCases,
      (tailCase) =>
        Effect.sync(() => {
          const quantiles = Arr.make(0, 0.01, 0.1, 0.5, 0.9, 0.99, 1)
          const draws = Arr.map(quantiles, (quantile) => sample(quantile, tailCase.params))
          const roundTripDiffs = Arr.map(quantiles, (quantile) => {
            const recovered = cdf(sample(quantile, tailCase.params), tailCase.params)
            return Float64.abs(recovered - quantile)
          })

          expect(Arr.every(draws, (draw) => draw >= tailCase.params.low && draw <= tailCase.params.high)).toBe(true)
          expect(Arr.every(roundTripDiffs, (diff) => diff <= ROUNDTRIP_QUANTILE_TOLERANCE)).toBe(true)
        }),
      { discard: true }
    ))
})
