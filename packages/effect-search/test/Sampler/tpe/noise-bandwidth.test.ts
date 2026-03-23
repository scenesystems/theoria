import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Option } from "effect"

import { buildContinuousParzen } from "../../../src/internal/tpe/continuousParzen.js"
import { defaultNoiseBandwidthOptions, NoiseBandwidthOptions } from "../../../src/internal/tpe/noiseEstimator.js"
import { CompletedTrialForSplit } from "../../../src/internal/tpe/splitTrials.js"
import { rngByTrial } from "../../../src/Sampler/shared/rngByTrial.js"
import { traceForParameter } from "../../../src/samplers/Tpe/mixed.js"
import { validateOptions } from "../../../src/samplers/Tpe/options.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"

const sigmaAt = (values: ReadonlyArray<number>, index: number): number =>
  Option.fromNullable(values[index]).pipe(Option.getOrElse(() => 0))

describe("noise-aware bandwidth", () => {
  it.effect("widens continuous KDE sigmas when noise-aware mode is enabled", () =>
    Effect.sync(() => {
      const observations = [0.02, 0.91, 0.16, 0.84, 0.28, 0.73]
      const baseline = buildContinuousParzen(observations, 0, 1)
      const noiseAware = buildContinuousParzen(
        observations,
        0,
        1,
        new NoiseBandwidthOptions({
          noiseAware: true,
          noiseAlpha: 4
        })
      )
      const baselineSigmas = Arr.map(baseline.kernels, (kernel) => kernel.sigma)
      const widenedSigmas = Arr.map(noiseAware.kernels, (kernel) => kernel.sigma)

      expect(
        Arr.every(widenedSigmas, (sigma, index) => sigma >= sigmaAt(baselineSigmas, index))
      ).toBe(true)
      expect(
        Arr.some(widenedSigmas, (sigma, index) => sigma - sigmaAt(baselineSigmas, index) > 1e-12)
      ).toBe(true)
    }))

  it.effect("uses empirical trial variance when available before bootstrap-only fallback", () =>
    Effect.sync(() => {
      const observations = [0.45, 0.46, 0.47, 0.48, 0.49]
      const options = new NoiseBandwidthOptions({
        noiseAware: true,
        noiseAlpha: 4
      })
      const bootstrapOnly = buildContinuousParzen(observations, 0, 1, options)
      const empiricalAware = buildContinuousParzen(observations, 0, 1, options, Option.some(0.2))
      const bootstrapSigmas = Arr.map(bootstrapOnly.kernels, (kernel) => kernel.sigma)
      const empiricalSigmas = Arr.map(empiricalAware.kernels, (kernel) => kernel.sigma)

      expect(
        Arr.some(empiricalSigmas, (sigma, index) => sigma - sigmaAt(bootstrapSigmas, index) > 1e-12)
      ).toBe(true)
    }))

  it.effect("preserves exact baseline behavior when noiseAware is false", () =>
    Effect.sync(() => {
      const observations = [0.1, 0.2, 0.7, 0.9]
      const baseline = buildContinuousParzen(observations, 0, 1)
      const explicitDisabled = buildContinuousParzen(
        observations,
        0,
        1,
        new NoiseBandwidthOptions({
          noiseAware: false,
          noiseAlpha: 3
        })
      )

      expect(
        Arr.map(explicitDisabled.kernels, (kernel) => kernel.sigma)
      ).toStrictEqual(Arr.map(baseline.kernels, (kernel) => kernel.sigma))
      expect(defaultNoiseBandwidthOptions.noiseAware).toBe(false)
    }))

  it.effect("threads noise settings into mixed float trace scoring", () =>
    Effect.gen(function*() {
      const space = SearchSpace.unsafeMake({
        lr: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
        optimizer: SearchSpace.categorical(["adam", "sgd"])
      })
      const parameter = Option.fromNullable(space.params[0]).pipe(
        Option.getOrElse(() =>
          new SearchSpace.ParameterMetadata({
            name: "lr",
            distribution: { type: "float", low: 1e-4, high: 1e-1, scale: "log" },
            activeWhen: []
          })
        )
      )
      const split = {
        below: [
          new CompletedTrialForSplit({
            trialNumber: 0,
            config: { lr: 0.001, optimizer: "adam" },
            value: 0.2
          }),
          new CompletedTrialForSplit({
            trialNumber: 1,
            config: { lr: 0.015, optimizer: "sgd" },
            value: 0.26
          }),
          new CompletedTrialForSplit({
            trialNumber: 2,
            config: { lr: 0.004, optimizer: "adam" },
            value: 0.31
          })
        ],
        above: [
          new CompletedTrialForSplit({
            trialNumber: 3,
            config: { lr: 0.06, optimizer: "adam" },
            value: 0.81
          }),
          new CompletedTrialForSplit({
            trialNumber: 4,
            config: { lr: 0.08, optimizer: "sgd" },
            value: 0.94
          }),
          new CompletedTrialForSplit({
            trialNumber: 5,
            config: { lr: 0.045, optimizer: "adam" },
            value: 0.77
          })
        ]
      }

      const baselineTrace = yield* traceForParameter(
        rngByTrial("tpe", 91, 7),
        24,
        parameter,
        split,
        defaultNoiseBandwidthOptions
      )
      const noiseAwareTrace = yield* traceForParameter(
        rngByTrial("tpe", 91, 7),
        24,
        parameter,
        split,
        new NoiseBandwidthOptions({
          noiseAware: true,
          noiseAlpha: 4
        })
      )

      yield* Effect.sync(() => {
        expect(
          Arr.some(baselineTrace.trace.scores, (score, index) =>
            Math.abs(score - sigmaAt(noiseAwareTrace.trace.scores, index)) > 1e-10)
        ).toBe(true)
      })
    }))

  it.effect("rejects out-of-range noiseAlpha values", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        validateOptions({
          noiseAware: true,
          noiseAlpha: 100
        })
      )

      expect(Either.isLeft(result)).toBe(true)
    }))
})
