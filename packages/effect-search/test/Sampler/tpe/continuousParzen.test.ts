import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num } from "effect"
import { exp, logStrict } from "effect-math/Numeric"

import {
  buildContinuousParzen,
  ContinuousKernel,
  ContinuousParzen,
  logDensity,
  sampleFromParzen
} from "../../../src/internal/tpe/continuousParzen.js"
import { logPdf as truncatedLogPdf, TruncatedNormalParams } from "../../../src/internal/tpe/truncatedNormal.js"

describe("tpe continuous parzen", () => {
  it.effect("injects a prior kernel at the midpoint of the support with normalized weights", () =>
    Effect.sync(() => {
      const parzen = buildContinuousParzen([0.1, 0.3, 0.8], 0, 1)
      const priorKernel = parzen.kernels[parzen.kernels.length - 1]
      const weightSum = parzen.kernels.reduce((total, kernel) => total + kernel.weight, 0)

      expect(priorKernel).toBeDefined()

      if (!priorKernel) {
        return
      }

      expect(priorKernel.mean).toBeCloseTo(0.5, 12)
      expect(priorKernel.sigma).toBeCloseTo(1, 12)
      expect(weightSum).toBeCloseTo(1, 12)
      parzen.kernels.forEach((kernel) => {
        expect(kernel.weight).toBeCloseTo(0.25, 12)
      })
    }))

  it.effect("uses Optuna-style neighbor-gap bandwidths with magic-clip floors", () =>
    Effect.sync(() => {
      const parzen = buildContinuousParzen([0.2, 0.4, 0.7], 0, 1)
      const minSigma = 1 / 5
      const observationKernels = parzen.kernels.slice(0, 3)

      observationKernels.forEach((kernel) => {
        expect(kernel.sigma).toBeCloseTo(0.2, 12)
        expect(kernel.sigma).toBeGreaterThanOrEqual(minSigma)
        expect(kernel.sigma).toBeLessThanOrEqual(1)
      })
    }))

  it.effect("computes weighted mixture log-density via stable log-sum-exp", () =>
    Effect.sync(() => {
      const parzen = new ContinuousParzen({
        low: 0,
        high: 1,
        kernels: [
          new ContinuousKernel({ mean: 0.2, sigma: 0.1, weight: 0.9 }),
          new ContinuousKernel({ mean: 0.8, sigma: 0.1, weight: 0.1 })
        ]
      })
      const probe = 0.6
      const componentScores = parzen.kernels.map((kernel) =>
        logStrict(kernel.weight) +
        truncatedLogPdf(
          probe,
          new TruncatedNormalParams({
            mean: kernel.mean,
            sigma: kernel.sigma,
            low: parzen.low,
            high: parzen.high
          })
        )
      )
      const maxScore = componentScores.reduce(
        (currentMax, score) => Num.max(currentMax, score),
        Number.NEGATIVE_INFINITY
      )
      const expected = maxScore +
        logStrict(
          componentScores.reduce((total, score) => total + exp(score - maxScore), 0)
        )

      expect(logDensity(parzen, probe)).toBeCloseTo(expected, 12)
    }))

  it.effect("draws kernels according to cumulative kernel weights", () =>
    Effect.sync(() => {
      const parzen = new ContinuousParzen({
        low: 0,
        high: 1,
        kernels: [
          new ContinuousKernel({ mean: 0.2, sigma: 0.001, weight: 0.9 }),
          new ContinuousKernel({ mean: 0.8, sigma: 0.001, weight: 0.1 })
        ]
      })
      const firstKernelSample = sampleFromParzen(parzen, 0.1, 0.5)
      const secondKernelSample = sampleFromParzen(parzen, 0.95, 0.5)

      expect(firstKernelSample).toBeLessThan(0.3)
      expect(secondKernelSample).toBeGreaterThan(0.7)
    }))

  it.effect("samples stay within configured bounds", () =>
    Effect.sync(() => {
      const low = -2
      const high = 3
      const parzen = buildContinuousParzen([-1.2, 0.3, 2.4], low, high)
      const samples = Arr.makeBy(200, (index) => {
        const kernelRoll = (index % 20) / 20
        const valueRoll = ((index * 11) % 100) / 100

        return sampleFromParzen(parzen, kernelRoll, valueRoll)
      })

      expect(samples.every((sample) => sample >= low && sample <= high)).toBe(true)
    }))
})
