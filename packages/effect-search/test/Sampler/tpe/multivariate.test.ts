import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  diagonalGaussianLogDensity,
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussian,
  sampleDiagonalGaussianMixture,
  scottsBandwidth,
  scottsFactor
} from "../../../src/internal/tpe/multivariateGaussian.js"

const numberAt = (values: Iterable<number>, index: number): number =>
  Arr.get(Arr.fromIterable(values), index).pipe(Option.getOrElse(() => Number.NaN))

describe("multivariate gaussian foundations", () => {
  it.effect("computes diagonal gaussian log density for matching dimensions", () =>
    Effect.sync(() => {
      const logDensity = diagonalGaussianLogDensity(Arr.make(0, 0), Arr.make(0, 0), Arr.make(1, 1))
      const expected = Num.negate(Numeric.logStrict(Num.multiply(2, Numeric.pi)))

      expect(logDensity).toBeCloseTo(expected, 12)
    }))

  it.effect("returns negative infinity for dimension mismatch", () =>
    Effect.sync(() => {
      const logDensity = diagonalGaussianLogDensity(Arr.make(0, 0), Arr.make(0), Arr.make(1, 1))
      expect(logDensity).toBe(Number.NEGATIVE_INFINITY)
    }))

  it.effect("uses Scott's factor to shrink bandwidth as sample count grows", () =>
    Effect.sync(() => {
      const smallerSampleFactor = scottsFactor(10, 2)
      const largerSampleFactor = scottsFactor(100, 2)
      const smallerSampleBandwidth = scottsBandwidth(10, 2, 1)
      const largerSampleBandwidth = scottsBandwidth(100, 2, 1)

      expect(largerSampleFactor).toBeLessThan(smallerSampleFactor)
      expect(largerSampleBandwidth).toBeLessThan(smallerSampleBandwidth)
    }))

  it.effect("samples deterministic coordinates from a diagonal gaussian kernel", () =>
    Effect.sync(() => {
      const sample = sampleDiagonalGaussian(Arr.make(0.5, Num.negate(1)), Arr.make(0.2, 0.4), Arr.make(0.1, 0.9))

      expect(sample).toHaveLength(2)
      expect(numberAt(sample, 0)).toBeCloseTo(0.2436896868910798, 12)
      expect(numberAt(sample, 1)).toBeCloseTo(Num.negate(0.4873793737821596), 12)
    }))

  it.effect("samples and scores a diagonal gaussian mixture", () =>
    Effect.sync(() => {
      const means = Arr.make(Arr.make(0.2, Num.negate(0.3)), Arr.make(1.1, 0.6))
      const sigmas = Arr.make(Arr.make(0.1, 0.2), Arr.make(0.3, 0.4))
      const weights = Arr.make(0.75, 0.25)
      const sample = sampleDiagonalGaussianMixture(means, sigmas, weights, 0.2, Arr.make(0.35, 0.7))
      const logDensity = diagonalGaussianMixtureLogDensity(sample, means, sigmas, weights)

      expect(sample).toHaveLength(2)
      expect(numberAt(sample, 0)).toBeCloseTo(0.16146795335924322, 12)
      expect(numberAt(sample, 1)).toBeCloseTo(Num.negate(0.1951198974583919), 12)
      expect(logDensity).toBeCloseTo(1.574801336561569, 12)
    }))
})
