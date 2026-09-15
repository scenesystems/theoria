import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import { buildContinuousParzen } from "../../../src/internal/tpe/continuousParzen.js"
import {
  bandwidthScaleFromNoiseEstimate,
  estimateNoise,
  NoiseBandwidthOptions
} from "../../../src/internal/tpe/noiseEstimator.js"
import { FixtureRegistryLive, loadFixture, NoiseBandwidthFixtureSchema } from "../../helpers/fixtures/index.js"

describe("noise-aware bandwidth parity", () => {
  it.effect("replays FM-15 fixture-backed noise-bandwidth expectations", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("noise-bandwidth.parity").pipe(
        Effect.provide(FixtureRegistryLive)
      )
      const fixture = yield* Schema.decodeUnknown(NoiseBandwidthFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.sync(() => {
            const options = new NoiseBandwidthOptions({
              noiseAware: true,
              noiseAlpha: entry.alpha
            })
            const baseline = buildContinuousParzen(entry.observations, entry.low, entry.high)
            const adjusted = buildContinuousParzen(
              entry.observations,
              entry.low,
              entry.high,
              options
            )
            const estimate = estimateNoise(entry.observations, entry.low, entry.high)
            const baselineSigmas = Arr.map(baseline.kernels, (kernel) => kernel.sigma)
            const adjustedSigmas = Arr.map(adjusted.kernels, (kernel) => kernel.sigma)

            Arr.forEach(entry.expected.baseSigmas, (expected, index) => {
              expect(Arr.get(baselineSigmas, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expected, 9)
            })
            Arr.forEach(entry.expected.adjustedSigmas, (expected, index) => {
              expect(Arr.get(adjustedSigmas, index).pipe(Option.getOrElse(() => Number.NaN))).toBeCloseTo(expected, 9)
            })
            expect(estimate.normalizedNoise).toBeCloseTo(entry.expected.normalizedNoise, 9)
            expect(
              bandwidthScaleFromNoiseEstimate(estimate, options)
            ).toBeCloseTo(entry.expected.bandwidthScale, 9)
          }),
        { discard: true }
      )
    }))
})
