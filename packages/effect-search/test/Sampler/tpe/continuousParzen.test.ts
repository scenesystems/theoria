import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, FastCheck, Number as Num, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  buildContinuousParzen,
  ContinuousKernel,
  ContinuousParzen,
  logDensity,
  sampleFromParzen
} from "../../../src/internal/tpe/continuousParzen.js"
import { prepareLogDensity } from "../../../src/internal/tpe/continuousParzen/density.js"
import { sampleFromParzenBatch } from "../../../src/internal/tpe/continuousParzen/sample.js"
import { logPdf as truncatedLogPdf, TruncatedNormalParams } from "../../../src/internal/tpe/truncatedNormal.js"

describe("tpe continuous parzen", () => {
  it.effect("injects a prior kernel at the midpoint of the support with normalized weights", () =>
    Effect.gen(function*() {
      const parzen = buildContinuousParzen(Arr.make(0.1, 0.3, 0.8), 0, 1)
      const priorKernel = yield* Arr.last(parzen.kernels)
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
      const parzen = buildContinuousParzen(Arr.make(0.2, 0.4, 0.7), 0, 1)
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
        kernels: Arr.make(
          new ContinuousKernel({ mean: 0.2, sigma: 0.1, weight: 0.9 }),
          new ContinuousKernel({ mean: 0.8, sigma: 0.1, weight: 0.1 })
        )
      })
      const probe = 0.6
      const componentScores = Arr.map(parzen.kernels, (kernel) =>
        Num.sum(
          Numeric.logStrict(kernel.weight),
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
        Numeric.logStrict(
          Arr.reduce(componentScores, 0, (total, score) =>
            Num.sum(total, Numeric.pow(2.718281828459045, Num.subtract(score, maxScore))))
        )
      )

      expect(logDensity(parzen, probe)).toBeCloseTo(expected, 12)
    }))

  it.effect("prepared densities preserve zero weights, support boundaries, and invalid kernel semantics", () =>
    Effect.sync(() => {
      const parzen = new ContinuousParzen({
        low: Num.negate(1),
        high: 2,
        kernels: Arr.make(
          new ContinuousKernel({ mean: 0.3, sigma: 0.7, weight: 1 }),
          new ContinuousKernel({ mean: 1.4, sigma: 0.2, weight: 0 })
        )
      })
      const density = prepareLogDensity(parzen)
      const params = new TruncatedNormalParams({ mean: 0.3, sigma: 0.7, low: parzen.low, high: parzen.high })

      Arr.forEach(Arr.make(parzen.low, 0.4, parzen.high), (probe) => {
        expect(density(probe)).toBe(truncatedLogPdf(probe, params))
      })
      Arr.forEach(
        Arr.make(
          Num.subtract(parzen.low, 1e-12),
          Num.sum(parzen.high, 1e-12),
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY
        ),
        (probe) => {
          expect(density(probe)).toBe(Number.NEGATIVE_INFINITY)
        }
      )
      expect(density(Number.NaN)).toBeNaN()

      Arr.forEach(Arr.make(0, Num.negate(0.5), Number.NaN, Number.POSITIVE_INFINITY), (sigma) => {
        const invalid = prepareLogDensity(
          new ContinuousParzen({
            low: parzen.low,
            high: parzen.high,
            kernels: Arr.make(new ContinuousKernel({ mean: 0.3, sigma, weight: 1 }))
          })
        )
        expect(invalid(0.4)).toBeNaN()
        expect(invalid(Number.POSITIVE_INFINITY)).toBeNaN()
      })
      Arr.forEach(Arr.make(parzen.low, Num.subtract(parzen.low, 1)), (high) => {
        const invalid = prepareLogDensity(new ContinuousParzen({ ...parzen, high }))
        expect(invalid(0.4)).toBeNaN()
      })
      // Distinct support endpoints can round to the same standardized bound.
      const collapsed = prepareLogDensity(
        new ContinuousParzen({
          ...parzen,
          kernels: Arr.make(new ContinuousKernel({ mean: 1e20, sigma: 1, weight: 1 }))
        })
      )
      expect(collapsed(0.4)).toBeNaN()
      expect(collapsed(Number.POSITIVE_INFINITY)).toBeNaN()
      expect(prepareLogDensity(new ContinuousParzen({ ...parzen, kernels: Arr.empty() }))(0.4))
        .toBe(Number.NEGATIVE_INFINITY)
    }))

  it.effect("draws kernels according to cumulative kernel weights", () =>
    Effect.sync(() => {
      const parzen = new ContinuousParzen({
        low: 0,
        high: 1,
        kernels: Arr.make(
          new ContinuousKernel({ mean: 0.2, sigma: 0.001, weight: 0.9 }),
          new ContinuousKernel({ mean: 0.8, sigma: 0.001, weight: 0.1 })
        )
      })
      const firstKernelSample = sampleFromParzen(parzen, 0.1, 0.5)
      const secondKernelSample = sampleFromParzen(parzen, 0.95, 0.5)

      expect(firstKernelSample).toBeLessThan(0.3)
      expect(secondKernelSample).toBeGreaterThan(0.7)
    }))

  it.effect("batch sampling preserves cumulative-weight ties, zero weights, and roll order", () =>
    Effect.sync(() => {
      const model = new ContinuousParzen({
        low: -4,
        high: 8,
        kernels: Arr.make(
          new ContinuousKernel({ mean: -1, sigma: 0.001, weight: 0 }),
          new ContinuousKernel({ mean: 2, sigma: 0.001, weight: 0.25 }),
          new ContinuousKernel({ mean: 5, sigma: 0.001, weight: 0.75 })
        )
      })
      const rolls = Arr.map(Arr.make(1, 0, 0.25, 0.25000000000000006, -1, 0.1), (roll) => Tuple.make(roll, 0.5))
      const samples = sampleFromParzenBatch(model, rolls)
      // The truncation lies thousands of standard deviations from each mean:
      // its median rounds to that mean. A >= / > tie change selects another kernel.
      expect(samples).toEqual(Arr.make(5, -1, 2, 5, -1, 2))
      expect(sampleFromParzenBatch(model, Arr.empty())).toEqual(Arr.empty())
    }))

  it.effect.prop("batch sampling matches individual rolls across changing models and repeated selections", {
    observations: FastCheck.array(FastCheck.double({ min: -2, max: 3, noNaN: true }), { maxLength: 32 }),
    rolls: FastCheck.array(
      FastCheck.tuple(
        FastCheck.double({ min: 0, max: 1, noNaN: true }),
        FastCheck.double({ min: 0, max: 1, noNaN: true })
      ),
      { minLength: 2, maxLength: 24 }
    )
  }, ({ observations, rolls }) =>
    Effect.sync(() => {
      const first = buildContinuousParzen(observations, -2, 3)
      const second = buildContinuousParzen(Arr.empty<number>(), 9, 12)
      const expected = Arr.map(rolls, ([kernelRoll, valueRoll]) => sampleFromParzen(first, kernelRoll, valueRoll))
      expect(sampleFromParzenBatch(first, rolls)).toEqual(expected)
      expect(sampleFromParzenBatch(second, rolls)).toEqual(
        Arr.map(rolls, ([kernelRoll, valueRoll]) => sampleFromParzen(second, kernelRoll, valueRoll))
      )
      expect(sampleFromParzenBatch(first, rolls)).toEqual(expected)
    }))

  it.effect("samples stay within configured bounds", () =>
    Effect.sync(() => {
      const low = Num.negate(2)
      const high = 3
      const parzen = buildContinuousParzen(Arr.make(Num.negate(1.2), 0.3, 2.4), low, high)
      const samples = Arr.makeBy(200, (index) => {
        const kernelRoll = Num.unsafeDivide(Num.remainder(index, 20), 20)
        const valueRoll = Num.unsafeDivide(Num.remainder(Num.multiply(index, 11), 100), 100)

        return sampleFromParzen(parzen, kernelRoll, valueRoll)
      })

      expect(Arr.every(samples, (sample) =>
        Bool.and(Num.greaterThanOrEqualTo(sample, low), Num.lessThanOrEqualTo(sample, high)))).toBe(true)
    }))
})
