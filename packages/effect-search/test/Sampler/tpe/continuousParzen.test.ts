import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../../../src/internal/float64.js"
import {
  buildContinuousParzen,
  ContinuousKernel,
  ContinuousParzen,
  logDensity,
  sampleFromParzen
} from "../../../src/internal/tpe/continuousParzen.js"
import { logPdf as truncatedLogPdf, TruncatedNormalParams } from "../../../src/internal/tpe/truncatedNormal.js"
import { expandedBoundsForStep, normalizeFloat } from "../../../src/samplers/Tpe/dimensions/float.js"

const isNonNaN = Schema.is(Schema.NonNaN)

describe("tpe continuous parzen", () => {
  it.effect("injects a prior kernel at the midpoint of the support with normalized weights", () =>
    Effect.gen(function*() {
      const parzen = buildContinuousParzen([0.1, 0.3, 0.8], 0, 1)
      const priorKernel = yield* Arr.get(parzen.kernels, Num.decrement(Arr.length(parzen.kernels)))
      const weightSum = Arr.reduce(parzen.kernels, 0, (total, kernel) => Num.sum(total, kernel.weight))

      expect(priorKernel.mean).toBeCloseTo(0.5, 12)
      expect(priorKernel.sigma).toBeCloseTo(1, 12)
      expect(weightSum).toBeCloseTo(1, 12)
      Arr.forEach(parzen.kernels, (kernel) => {
        expect(kernel.weight).toBeCloseTo(0.25, 12)
      })
    }))

  it.effect("uses Optuna-style neighbor-gap bandwidths with magic-clip floors", () =>
    Effect.sync(() => {
      const parzen = buildContinuousParzen([0.2, 0.4, 0.7], 0, 1)
      const minSigma = Num.unsafeDivide(1, 5)
      const observationKernels = Arr.take(parzen.kernels, 3)

      Arr.forEach(observationKernels, (kernel) => {
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
      const componentScores = Arr.map(parzen.kernels, (kernel) =>
        Num.sum(
          Float64.log(kernel.weight),
          truncatedLogPdf(
            probe,
            new TruncatedNormalParams({
              mean: kernel.mean,
              sigma: kernel.sigma,
              low: parzen.low,
              high: parzen.high
            })
          )
        ))
      const maxScore = Arr.reduce(
        componentScores,
        Number.NEGATIVE_INFINITY,
        (currentMax, score) => Num.max(currentMax, score)
      )
      const expected = Num.sum(
        maxScore,
        Float64.log(
          Arr.reduce(componentScores, 0, (total, score) => Num.sum(total, Float64.exp(Num.subtract(score, maxScore))))
        )
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
        const kernelRoll = Num.unsafeDivide(Num.remainder(index, 20), 20)
        const valueRoll = Num.unsafeDivide(Num.remainder(Num.multiply(index, 11), 100), 100)

        return sampleFromParzen(parzen, kernelRoll, valueRoll)
      })

      expect(Arr.every(samples, (sample) =>
        Boolean.and(
          isNonNaN(sample),
          Boolean.and(Num.greaterThanOrEqualTo(sample, low), Num.lessThanOrEqualTo(sample, high))
        ))).toBe(true)
    }))

  it.effect("replays step quantization and half-step support expansion", () =>
    Effect.sync(() => {
      const step = Option.some(0.25)
      const [low, high] = expandedBoundsForStep(0, 1, step)

      expect(low).toBe(-0.125)
      expect(high).toBe(1.125)
      expect(normalizeFloat(0.74, 0, 1, step)).toBe(0.75)
      expect(normalizeFloat(-10, 0, 1, step)).toBe(0)
      expect(normalizeFloat(10, 0, 1, step)).toBe(1)
    }))
})
