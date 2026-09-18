import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FastCheck as fc, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import { diagonalGaussianLogDensity, sampleDiagonalGaussian } from "../../../src/internal/tpe/multivariateGaussian.js"

const finiteCoordinateArbitrary = fc.double({
  min: Num.negate(10),
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
  min: Num.negate(3),
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
  max: Num.subtract(1, 1e-6),
  noNaN: true,
  noDefaultInfinity: true
})

describe("multivariate gaussian invariants", () => {
  it.effect.prop(
    "is symmetric for mirrored offsets around the mean",
    Tuple.make(
      finiteCoordinateArbitrary,
      finiteCoordinateArbitrary,
      positiveSigmaArbitrary,
      positiveSigmaArbitrary,
      symmetricOffsetArbitrary,
      symmetricOffsetArbitrary
    ),
    ([meanX, meanY, sigmaX, sigmaY, offsetX, offsetY]) =>
      Effect.sync(() => {
        const left = diagonalGaussianLogDensity(
          Arr.make(Num.sum(meanX, offsetX), Num.sum(meanY, offsetY)),
          Arr.make(meanX, meanY),
          Arr.make(sigmaX, sigmaY)
        )
        const right = diagonalGaussianLogDensity(
          Arr.make(Num.subtract(meanX, offsetX), Num.subtract(meanY, offsetY)),
          Arr.make(meanX, meanY),
          Arr.make(sigmaX, sigmaY)
        )

        expect(Numeric.abs(Num.subtract(left, right))).toBeLessThanOrEqual(1e-8)
      }),
    { fastCheck: { numRuns: 300 } }
  )

  it.effect.prop(
    "decreases monotonically as distance from mean increases in 1D",
    Tuple.make(
      finiteCoordinateArbitrary,
      positiveSigmaArbitrary,
      offsetArbitrary,
      offsetArbitrary
    ),
    ([mean, sigma, firstOffset, secondOffset]) =>
      Effect.sync(() => {
        const nearOffset = Num.min(firstOffset, secondOffset)
        const farOffset = Num.max(firstOffset, secondOffset)
        const near = diagonalGaussianLogDensity(Arr.of(Num.sum(mean, nearOffset)), Arr.of(mean), Arr.of(sigma))
        const far = diagonalGaussianLogDensity(Arr.of(Num.sum(mean, farOffset)), Arr.of(mean), Arr.of(sigma))

        expect(near).toBeGreaterThanOrEqual(far)
      }),
    { fastCheck: { numRuns: 300 } }
  )

  it.effect.prop(
    "produces mirrored samples for mirrored quantile rolls",
    Tuple.make(
      finiteCoordinateArbitrary,
      positiveSigmaArbitrary,
      rollArbitrary
    ),
    ([mean, sigma, roll]) =>
      Effect.sync(() => {
        const left = Arr.head(sampleDiagonalGaussian(Arr.of(mean), Arr.of(sigma), Arr.of(roll))).pipe(
          Option.getOrElse(() => Number.NaN)
        )
        const right = Arr.head(sampleDiagonalGaussian(Arr.of(mean), Arr.of(sigma), Arr.of(Num.subtract(1, roll)))).pipe(
          Option.getOrElse(() => Number.NaN)
        )

        expect(Numeric.abs(Num.subtract(Num.sum(left, right), Num.multiply(2, mean)))).toBeLessThanOrEqual(1e-8)
      }),
    { fastCheck: { numRuns: 300 } }
  )
})
