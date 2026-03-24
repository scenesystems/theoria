import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"
import fc from "fast-check"

import * as Float64 from "../../src/internal/float64.js"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../src/internal/tpe/continuousParzen.js"

const boundsInputArbitrary = fc.record({
  center: fc.double({
    min: -20,
    max: 20,
    noNaN: true,
    noDefaultInfinity: true
  }),
  span: fc.double({
    min: 1e-6,
    max: 8,
    noNaN: true,
    noDefaultInfinity: true
  })
})

const quantileArbitrary = fc.double({
  min: 0,
  max: 1,
  noNaN: true,
  noDefaultInfinity: true
})

const observationQuantilesArbitrary = fc.array(quantileArbitrary, {
  minLength: 0,
  maxLength: 40
})

const probeQuantilesArbitrary = fc.array(quantileArbitrary, {
  minLength: 1,
  maxLength: 64
})

const rollArbitrary = fc.double({
  min: -2,
  max: 2,
  noNaN: true,
  noDefaultInfinity: true
})

const rollPairsArbitrary = fc.array(fc.tuple(rollArbitrary, rollArbitrary), {
  minLength: 1,
  maxLength: 128
})

const WEIGHT_ABSOLUTE_TOLERANCE = 1e-12
const MIDPOINT_ABSOLUTE_TOLERANCE = 1e-12

const deterministicEdgeScenarios = [
  {
    id: "endpoint-observations",
    observations: Arr.make(0, 0, 1, 1),
    low: 0,
    high: 1,
    probes: Arr.make(0, 0.0001, 0.5, 0.9999, 1)
  },
  {
    id: "bimodal-separated",
    observations: Arr.make(-8.5, -7.9, 7.4, 8.1),
    low: -10,
    high: 10,
    probes: Arr.make(-9.5, -8.0, 0, 8.0, 9.5)
  },
  {
    id: "narrow-support",
    observations: Arr.make(9.9991, 9.9993, 10.0002, 10.0004),
    low: 9.999,
    high: 10.001,
    probes: Arr.make(9.999, 9.9995, 10.0005, 10.001)
  },
  {
    id: "tiny-cross-zero-span",
    observations: Arr.make(-0.0008, -0.0002, 0.0003, 0.0007),
    low: -0.001,
    high: 0.001,
    probes: Arr.make(-0.001, -0.0004, 0, 0.0004, 0.001)
  },
  {
    id: "offset-positive-range",
    observations: Arr.make(100.2, 100.7, 104.4, 108.8),
    low: 100,
    high: 110,
    probes: Arr.make(100.0, 100.5, 105.0, 109.5)
  },
  {
    id: "micro-positive-span",
    observations: Arr.make(0.5000004, 0.5000011, 0.5000028, 0.5000032),
    low: 0.5,
    high: 0.500004,
    probes: Arr.make(0.5, 0.5000008, 0.500002, 0.5000036, 0.500004)
  },
  {
    id: "extreme-asymmetric-range",
    observations: Arr.make(-49.5, -48.9, -30.2, 0.6),
    low: -50,
    high: 1,
    probes: Arr.make(-50.0, -49.0, -35.0, -5.0, 1.0)
  },
  {
    id: "upper-boundary-cluster",
    observations: Arr.make(9.6, 9.8, 9.95, 10.0, 10.0),
    low: 0,
    high: 10,
    probes: Arr.make(0.0, 5.0, 9.7, 9.98, 10.0)
  }
]

const toBounds = (input: { readonly center: number; readonly span: number }): readonly [number, number] => [
  input.center - input.span,
  input.center + input.span
]

const pointOnSupport = (low: number, high: number, quantile: number): number => low + quantile * (high - low)

describe("continuous KDE invariants", () => {
  it.effect("kernel simplex remains normalized with positive sigmas", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(boundsInputArbitrary, observationQuantilesArbitrary, (boundsInput, quantiles) => {
          const [low, high] = toBounds(boundsInput)
          const observations = Arr.map(quantiles, (quantile) => pointOnSupport(low, high, quantile))
          const parzen = buildContinuousParzen(observations, low, high)
          const weightSum = Arr.reduce(parzen.kernels, 0, (total, kernel) => total + kernel.weight)

          expect(parzen.kernels.length).toBe(observations.length + 1)
          expect(Float64.abs(weightSum - 1)).toBeLessThanOrEqual(WEIGHT_ABSOLUTE_TOLERANCE)
          expect(Arr.every(parzen.kernels, (kernel) => Number.isFinite(kernel.weight) && kernel.weight >= 0)).toBe(true)
          expect(Arr.every(parzen.kernels, (kernel) => Number.isFinite(kernel.sigma) && kernel.sigma > 0)).toBe(true)
        })
      )
    }))

  it.effect("kernel means stay on support and prior kernel anchors midpoint", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(boundsInputArbitrary, observationQuantilesArbitrary, (boundsInput, quantiles) => {
          const [low, high] = toBounds(boundsInput)
          const observations = Arr.map(quantiles, (quantile) => pointOnSupport(low, high, quantile))
          const parzen = buildContinuousParzen(observations, low, high)
          const priorKernelOption = Arr.last(parzen.kernels)

          expect(Arr.every(parzen.kernels, (kernel) => kernel.mean >= low && kernel.mean <= high)).toBe(true)
          expect(Option.isSome(priorKernelOption)).toBe(true)

          const midpoint = (low + high) / 2
          const priorMean = Option.match(priorKernelOption, {
            onNone: () => Number.NaN,
            onSome: (priorKernel) => priorKernel.mean
          })

          expect(Float64.abs(priorMean - midpoint)).toBeLessThanOrEqual(MIDPOINT_ABSOLUTE_TOLERANCE)
        })
      )
    }))

  it.effect("logDensity stays finite for support probes", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          boundsInputArbitrary,
          observationQuantilesArbitrary,
          probeQuantilesArbitrary,
          (boundsInput, observationsRaw, probesRaw) => {
            const [low, high] = toBounds(boundsInput)
            const observations = Arr.map(observationsRaw, (quantile) => pointOnSupport(low, high, quantile))
            const probes = Arr.map(probesRaw, (quantile) => pointOnSupport(low, high, quantile))
            const parzen = buildContinuousParzen(observations, low, high)

            expect(Arr.every(probes, (probe) => Number.isFinite(logDensity(parzen, probe)))).toBe(true)
            expect(
              Arr.every(probes, (probe) => Float64.abs(logDensity(parzen, probe) - logDensity(parzen, probe)) <= 0)
            ).toBe(true)
          }
        )
      )
    }))

  it.effect("sampling remains bounded and deterministic for repeated roll traces", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          boundsInputArbitrary,
          observationQuantilesArbitrary,
          rollPairsArbitrary,
          (boundsInput, observationsRaw, rollPairs) => {
            const [low, high] = toBounds(boundsInput)
            const observations = Arr.map(observationsRaw, (quantile) => pointOnSupport(low, high, quantile))
            const parzen = buildContinuousParzen(observations, low, high)
            const draws = Arr.map(
              rollPairs,
              ([kernelRoll, valueRoll]) => sampleFromParzen(parzen, kernelRoll, valueRoll)
            )
            const replay = Arr.map(
              rollPairs,
              ([kernelRoll, valueRoll]) => sampleFromParzen(parzen, kernelRoll, valueRoll)
            )

            expect(Arr.every(draws, (value) => value >= low && value <= high)).toBe(true)
            expect(
              Arr.every(draws, (value, index) => Float64.abs(value - (replay[index] ?? Number.NaN)) <= 0)
            ).toBe(true)
          }
        )
      )
    }))

  it.effect("sampling matches clamped roll semantics", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          boundsInputArbitrary,
          observationQuantilesArbitrary,
          rollPairsArbitrary,
          (boundsInput, observationsRaw, rollPairs) => {
            const [low, high] = toBounds(boundsInput)
            const observations = Arr.map(observationsRaw, (quantile) => pointOnSupport(low, high, quantile))
            const parzen = buildContinuousParzen(observations, low, high)

            expect(
              Arr.every(rollPairs, ([kernelRoll, valueRoll]) => {
                const clampedKernelRoll = Num.clamp(kernelRoll, {
                  minimum: 0,
                  maximum: 1
                })
                const clampedValueRoll = Num.clamp(valueRoll, {
                  minimum: 0,
                  maximum: 1
                })

                return (
                  Float64.abs(
                    sampleFromParzen(parzen, kernelRoll, valueRoll) -
                      sampleFromParzen(parzen, clampedKernelRoll, clampedValueRoll)
                  ) <= 0
                )
              })
            ).toBe(true)
          }
        )
      )
    }))

  it.effect("deterministic continuous edge scenarios keep finite densities and bounded sampling", () =>
    Effect.forEach(
      deterministicEdgeScenarios,
      (scenario) =>
        Effect.sync(() => {
          const parzen = buildContinuousParzen(scenario.observations, scenario.low, scenario.high)
          const replayRolls: ReadonlyArray<readonly [number, number]> = [[0, 0], [0.5, 0.5], [1, 1]]
          const draws = Arr.map(
            replayRolls,
            ([kernelRoll, valueRoll]) => sampleFromParzen(parzen, kernelRoll, valueRoll)
          )

          expect(Arr.every(scenario.probes, (probe) => Number.isFinite(logDensity(parzen, probe)))).toBe(true)
          expect(Arr.every(draws, (value) => value >= scenario.low && value <= scenario.high)).toBe(true)
        }),
      { discard: true }
    ))
})
