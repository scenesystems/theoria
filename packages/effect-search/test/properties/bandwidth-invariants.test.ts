import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num } from "effect"
import fc from "fast-check"

import { buildContinuousParzen } from "../../src/internal/tpe/continuousParzen.js"
import { minimumBandwidth } from "../../src/internal/tpe/continuousParzen/helpers.js"
import {
  bandwidthScaleFromNoiseEstimate,
  estimateNoise,
  NoiseBandwidthOptions
} from "../../src/internal/tpe/noiseEstimator.js"

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
  it.effect("noise-aware scale is monotonic with respect to alpha", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(observationArbitrary, alphaArbitrary, alphaArbitrary, (observations, alphaA, alphaB) => {
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
        { numRuns: 300 }
      )
    }))

  it.effect("noise-aware sigmas stay inside clipping bounds", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(observationArbitrary, alphaArbitrary, (observations, alpha) => {
          const parzen = buildContinuousParzen(
            observations,
            0,
            1,
            new NoiseBandwidthOptions({
              noiseAware: true,
              noiseAlpha: alpha
            })
          )
          const minSigma = minimumBandwidth(0, 1, observations.length + 1)

          expect(
            parzen.kernels.every((kernel) => kernel.sigma >= minSigma && kernel.sigma <= 1)
          ).toBe(true)
        }),
        { numRuns: 300 }
      )
    }))

  it.effect("disabled noise mode always produces unit scaling", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(observationArbitrary, alphaArbitrary, (observations, alpha) => {
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
        { numRuns: 300 }
      )
    }))
})
