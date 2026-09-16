import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, FastCheck as fc, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { buildContinuousParzen, logDensity, sampleFromParzen } from "../../../src/internal/tpe/continuousParzen.js"

const boundsInputArbitrary = fc.record({
  center: fc.double({
    min: Num.negate(20),
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
  min: Num.negate(2),
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

const deterministicEdgeScenarios = Arr.make(
  {
    id: "endpoint-observations",
    observations: Arr.make(0, 0, 1, 1),
    low: 0,
    high: 1,
    probes: Arr.make(0, 0.0001, 0.5, 0.9999, 1)
  },
  {
    id: "bimodal-separated",
    observations: Arr.make(Num.negate(8.5), Num.negate(7.9), 7.4, 8.1),
    low: Num.negate(10),
    high: 10,
    probes: Arr.make(Num.negate(9.5), Num.negate(8), 0, 8, 9.5)
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
    observations: Arr.make(Num.negate(0.0008), Num.negate(0.0002), 0.0003, 0.0007),
    low: Num.negate(0.001),
    high: 0.001,
    probes: Arr.make(Num.negate(0.001), Num.negate(0.0004), 0, 0.0004, 0.001)
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
    observations: Arr.make(Num.negate(49.5), Num.negate(48.9), Num.negate(30.2), 0.6),
    low: Num.negate(50),
    high: 1,
    probes: Arr.make(Num.negate(50), Num.negate(49), Num.negate(35), Num.negate(5), 1)
  },
  {
    id: "upper-boundary-cluster",
    observations: Arr.make(9.6, 9.8, 9.95, 10.0, 10.0),
    low: 0,
    high: 10,
    probes: Arr.make(0.0, 5.0, 9.7, 9.98, 10.0)
  }
)

const toBounds = (input: { readonly center: number; readonly span: number }): readonly [number, number] =>
  Tuple.make(
    Num.subtract(input.center, input.span),
    Num.sum(input.center, input.span)
  )

const pointOnSupport = (low: number, high: number, quantile: number): number =>
  Num.sum(low, Num.multiply(quantile, Num.subtract(high, low)))

describe("continuous KDE invariants", () => {
  it.effect.prop(
    "kernel simplex remains normalized with positive sigmas",
    Tuple.make(
      boundsInputArbitrary,
      observationQuantilesArbitrary
    ),
    ([boundsInput, quantiles]) =>
      Effect.sync(() => {
        const [low, high] = toBounds(boundsInput)
        const observations = Arr.map(quantiles, (quantile) => pointOnSupport(low, high, quantile))
        const parzen = buildContinuousParzen(observations, low, high)
        const weightSum = Arr.reduce(parzen.kernels, 0, (total, kernel) => Num.sum(total, kernel.weight))

        expect(Arr.length(parzen.kernels)).toBe(Num.increment(Arr.length(observations)))
        expect(Numeric.abs(Num.subtract(weightSum, 1))).toBeLessThanOrEqual(WEIGHT_ABSOLUTE_TOLERANCE)
        expect(
          Arr.every(parzen.kernels, (kernel) =>
            Bool.and(Numeric.isFinite(kernel.weight), Num.greaterThanOrEqualTo(kernel.weight, 0)))
        ).toBe(true)
        expect(
          Arr.every(
            parzen.kernels,
            (kernel) =>
              Bool.and(Numeric.isFinite(kernel.sigma), Num.greaterThan(kernel.sigma, 0))
          )
        ).toBe(true)
      })
  )

  it.effect.prop(
    "kernel means stay on support and prior kernel anchors midpoint",
    Tuple.make(
      boundsInputArbitrary,
      observationQuantilesArbitrary
    ),
    ([boundsInput, quantiles]) =>
      Effect.sync(() => {
        const [low, high] = toBounds(boundsInput)
        const observations = Arr.map(quantiles, (quantile) => pointOnSupport(low, high, quantile))
        const parzen = buildContinuousParzen(observations, low, high)
        const priorKernelOption = Arr.last(parzen.kernels)

        expect(
          Arr.every(parzen.kernels, (kernel) =>
            Bool.and(Num.greaterThanOrEqualTo(kernel.mean, low), Num.lessThanOrEqualTo(kernel.mean, high)))
        ).toBe(true)
        expect(Option.isSome(priorKernelOption)).toBe(true)

        const midpoint = Num.unsafeDivide(Num.sum(low, high), 2)
        const priorMean = Option.match(priorKernelOption, {
          onNone: () =>
            Number.NaN,
          onSome: (priorKernel) => priorKernel.mean
        })

        expect(Numeric.abs(Num.subtract(priorMean, midpoint))).toBeLessThanOrEqual(MIDPOINT_ABSOLUTE_TOLERANCE)
      })
  )

  it.effect.prop(
    "logDensity stays finite for support probes",
    Tuple.make(
      boundsInputArbitrary,
      observationQuantilesArbitrary,
      probeQuantilesArbitrary
    ),
    ([boundsInput, observationsRaw, probesRaw]) =>
      Effect.sync(() => {
        const [low, high] = toBounds(boundsInput)
        const observations = Arr.map(observationsRaw, (quantile) => pointOnSupport(low, high, quantile))
        const probes = Arr.map(probesRaw, (quantile) => pointOnSupport(low, high, quantile))
        const parzen = buildContinuousParzen(observations, low, high)

        expect(Arr.every(probes, (probe) => Numeric.isFinite(logDensity(parzen, probe)))).toBe(true)
        expect(
          Arr.every(probes, (probe) =>
            Num.lessThanOrEqualTo(
              Numeric.abs(Num.subtract(logDensity(parzen, probe), logDensity(parzen, probe))),
              0
            ))
        ).toBe(true)
      })
  )

  it.effect.prop(
    "sampling remains bounded and deterministic for repeated roll traces",
    Tuple.make(
      boundsInputArbitrary,
      observationQuantilesArbitrary,
      rollPairsArbitrary
    ),
    ([boundsInput, observationsRaw, rollPairs]) =>
      Effect.sync(() => {
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

        expect(
          Arr.every(
            draws,
            (value) => Bool.and(Num.greaterThanOrEqualTo(value, low), Num.lessThanOrEqualTo(value, high))
          )
        ).toBe(true)
        expect(
          Arr.every(draws, (value, index) =>
            Num.lessThanOrEqualTo(
              Numeric.abs(
                Num.subtract(value, Arr.get(replay, index).pipe(Option.getOrElse(() => Number.NaN)))
              ),
              0
            ))
        ).toBe(true)
      })
  )

  it.effect.prop(
    "sampling matches clamped roll semantics",
    Tuple.make(
      boundsInputArbitrary,
      observationQuantilesArbitrary,
      rollPairsArbitrary
    ),
    ([boundsInput, observationsRaw, rollPairs]) =>
      Effect.sync(() => {
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

            return Num.lessThanOrEqualTo(
              Numeric.abs(
                Num.subtract(
                  sampleFromParzen(parzen, kernelRoll, valueRoll),
                  sampleFromParzen(parzen, clampedKernelRoll, clampedValueRoll)
                )
              ),
              0
            )
          })
        ).toBe(true)
      })
  )

  it.effect("deterministic continuous edge scenarios keep finite densities and bounded sampling", () =>
    Effect.forEach(
      deterministicEdgeScenarios,
      (scenario) =>
        Effect.sync(() => {
          const parzen = buildContinuousParzen(scenario.observations, scenario.low, scenario.high)
          const replayRolls = Arr.make(Tuple.make(0, 0), Tuple.make(0.5, 0.5), Tuple.make(1, 1))
          const draws = Arr.map(
            replayRolls,
            ([kernelRoll, valueRoll]) => sampleFromParzen(parzen, kernelRoll, valueRoll)
          )

          expect(Arr.every(scenario.probes, (probe) => Numeric.isFinite(logDensity(parzen, probe)))).toBe(true)
          expect(
            Arr.every(
              draws,
              (value) =>
                Bool.and(Num.greaterThanOrEqualTo(value, scenario.low), Num.lessThanOrEqualTo(value, scenario.high))
            )
          ).toBe(true)
        }),
      { discard: true }
    ))
})
