import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, FastCheck as fc, Number as Num, Tuple } from "effect"

import { buildContinuousParzen } from "../../../src/internal/tpe/continuousParzen.js"
import { minimumBandwidth } from "../../../src/internal/tpe/continuousParzen/kernels.js"
import {
  bandwidthScaleFromNoiseEstimate,
  estimateNoise,
  NoiseBandwidthOptions
} from "../../../src/internal/tpe/noiseEstimator.js"

const observationArbitrary = fc.array(
  fc.double({
    min: 0,
    max: 1,
    noNaN: true,
    noDefaultInfinity: true
  }),
  {
    minLength: 2,
    maxLength: 24
  }
)

const alphaArbitrary = fc.double({
  min: 0,
  max: 10,
  noNaN: true,
  noDefaultInfinity: true
})

describe("bandwidth invariants", () => {
  it.effect.prop(
    "noise-aware scale is monotonic with respect to alpha",
    Tuple.make(
      observationArbitrary,
      alphaArbitrary,
      alphaArbitrary
    ),
    ([observations, alphaA, alphaB]) =>
      Effect.sync(() => {
        const lowerAlpha = Num.min(alphaA, alphaB)
        const higherAlpha = Num.max(alphaA, alphaB)
        const estimate = estimateNoise(observations, 0, 1)
        const lowerScale = bandwidthScaleFromNoiseEstimate(
          estimate,
          new NoiseBandwidthOptions({
            noiseAware: true,
            noiseAlpha: lowerAlpha
          })
        )
        const higherScale = bandwidthScaleFromNoiseEstimate(
          estimate,
          new NoiseBandwidthOptions({
            noiseAware: true,
            noiseAlpha: higherAlpha
          })
        )

        expect(higherScale).toBeGreaterThanOrEqual(lowerScale)
      }),
    { fastCheck: { numRuns: 300 } }
  )

  it.effect.prop(
    "noise-aware sigmas stay inside clipping bounds",
    Tuple.make(observationArbitrary, alphaArbitrary),
    ([observations, alpha]) =>
      Effect.sync(() => {
        const parzen = buildContinuousParzen(
          observations,
          0,
          1,
          new NoiseBandwidthOptions({
            noiseAware: true,
            noiseAlpha: alpha
          })
        )
        const minSigma = minimumBandwidth(0, 1, Num.increment(Arr.length(observations)))

        expect(
          Arr.every(parzen.kernels, (kernel) =>
            Bool.and(Num.greaterThanOrEqualTo(kernel.sigma, minSigma), Num.lessThanOrEqualTo(kernel.sigma, 1)))
        ).toBe(true)
      }),
    { fastCheck: { numRuns: 300 } }
  )

  it.effect.prop(
    "disabled noise mode always produces unit scaling",
    Tuple.make(observationArbitrary, alphaArbitrary),
    ([observations, alpha]) =>
      Effect.sync(() => {
        const estimate = estimateNoise(observations, 0, 1)
        const scale = bandwidthScaleFromNoiseEstimate(
          estimate,
          new NoiseBandwidthOptions({
            noiseAware: false,
            noiseAlpha: alpha
          })
        )

        expect(scale).toBe(1)
      }),
    { fastCheck: { numRuns: 300 } }
  )
})
