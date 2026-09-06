import { describe, expect, it } from "@effect/vitest"
import { Effect, FastCheck as fc, Number as Num } from "effect"

import { diagonalGaussianLogDensity, sampleDiagonalGaussian } from "../../src/internal/tpe/multivariateGaussian.js"

const finiteCoordinateArbitrary = fc.double({
  min: -10,
  max: 10,
  noNaN: true,
  noDefaultInfinity: true
})

const positiveSigmaArbitrary = fc.double({
  min: 1e-3,
  max: 5,
  noNaN: true,
  noDefaultInfinity: true
})

const symmetricOffsetArbitrary = fc.double({
  min: -3,
  max: 3,
  noNaN: true,
  noDefaultInfinity: true
})

const offsetArbitrary = fc.double({
  min: 0,
  max: 8,
  noNaN: true,
  noDefaultInfinity: true
})

const rollArbitrary = fc.double({
  min: 1e-6,
  max: 1 - 1e-6,
  noNaN: true,
  noDefaultInfinity: true
})

describe("multivariate gaussian invariants", () => {
  it.effect.prop("is symmetric for mirrored offsets around the mean", [
    finiteCoordinateArbitrary,
    finiteCoordinateArbitrary,
    positiveSigmaArbitrary,
    positiveSigmaArbitrary,
    symmetricOffsetArbitrary,
    symmetricOffsetArbitrary
  ], ([meanX, meanY, sigmaX, sigmaY, offsetX, offsetY]) =>
    Effect.sync(() => {
      const left = diagonalGaussianLogDensity(
        [meanX + offsetX, meanY + offsetY],
        [meanX, meanY],
        [sigmaX, sigmaY]
      )
      const right = diagonalGaussianLogDensity(
        [meanX - offsetX, meanY - offsetY],
        [meanX, meanY],
        [sigmaX, sigmaY]
      )

      expect(Math.abs(left - right)).toBeLessThanOrEqual(1e-8)
    }), { fastCheck: { numRuns: 300 } })

  it.effect.prop("decreases monotonically as distance from mean increases in 1D", [
    finiteCoordinateArbitrary,
    positiveSigmaArbitrary,
    offsetArbitrary,
    offsetArbitrary
  ], ([mean, sigma, firstOffset, secondOffset]) =>
    Effect.sync(() => {
      const nearOffset = Num.min(firstOffset, secondOffset)
      const farOffset = Num.max(firstOffset, secondOffset)
      const near = diagonalGaussianLogDensity([mean + nearOffset], [mean], [sigma])
      const far = diagonalGaussianLogDensity([mean + farOffset], [mean], [sigma])

      expect(near).toBeGreaterThanOrEqual(far)
    }), { fastCheck: { numRuns: 300 } })

  it.effect.prop("produces mirrored samples for mirrored quantile rolls", [
    finiteCoordinateArbitrary,
    positiveSigmaArbitrary,
    rollArbitrary
  ], ([mean, sigma, roll]) =>
    Effect.sync(() => {
      const left = sampleDiagonalGaussian([mean], [sigma], [roll])[0] ?? Number.NaN
      const right = sampleDiagonalGaussian([mean], [sigma], [1 - roll])[0] ?? Number.NaN

      expect(Math.abs((left + right) - 2 * mean)).toBeLessThanOrEqual(1e-8)
    }), { fastCheck: { numRuns: 300 } })
})
