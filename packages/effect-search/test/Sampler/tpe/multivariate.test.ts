import { describe, expect, it } from "@effect/vitest"

import {
  diagonalGaussianLogDensity,
  diagonalGaussianMixtureLogDensity,
  sampleDiagonalGaussian,
  sampleDiagonalGaussianMixture,
  scottsBandwidth,
  scottsFactor
} from "../../../src/internal/tpe/multivariateGaussian.js"

describe("multivariate gaussian foundations", () => {
  it("computes diagonal gaussian log density for matching dimensions", () => {
    const logDensity = diagonalGaussianLogDensity([0, 0], [0, 0], [1, 1])
    const expected = -Math.log(2 * Math.PI)

    expect(logDensity).toBeCloseTo(expected, 12)
  })

  it("returns negative infinity for dimension mismatch", () => {
    const logDensity = diagonalGaussianLogDensity([0, 0], [0], [1, 1])
    expect(logDensity).toBe(Number.NEGATIVE_INFINITY)
  })

  it("uses Scott's factor to shrink bandwidth as sample count grows", () => {
    const smallerSampleFactor = scottsFactor(10, 2)
    const largerSampleFactor = scottsFactor(100, 2)
    const smallerSampleBandwidth = scottsBandwidth(10, 2, 1)
    const largerSampleBandwidth = scottsBandwidth(100, 2, 1)

    expect(largerSampleFactor).toBeLessThan(smallerSampleFactor)
    expect(largerSampleBandwidth).toBeLessThan(smallerSampleBandwidth)
  })

  it("samples deterministic coordinates from a diagonal gaussian kernel", () => {
    const sample = sampleDiagonalGaussian([0.5, -1], [0.2, 0.4], [0.1, 0.9])

    expect(sample).toHaveLength(2)
    expect(sample[0]).toBeCloseTo(0.2436896868910798, 12)
    expect(sample[1]).toBeCloseTo(-0.4873793737821596, 12)
  })

  it("samples and scores a diagonal gaussian mixture", () => {
    const means = [
      [0.2, -0.3],
      [1.1, 0.6]
    ]
    const sigmas = [
      [0.1, 0.2],
      [0.3, 0.4]
    ]
    const weights = [0.75, 0.25]
    const sample = sampleDiagonalGaussianMixture(means, sigmas, weights, 0.2, [0.35, 0.7])
    const logDensity = diagonalGaussianMixtureLogDensity(sample, means, sigmas, weights)

    expect(sample).toHaveLength(2)
    expect(sample[0]).toBeCloseTo(0.16146795335924322, 12)
    expect(sample[1]).toBeCloseTo(-0.1951198974583919, 12)
    expect(logDensity).toBeCloseTo(1.574801336561569, 12)
  })
})
