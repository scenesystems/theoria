import { describe, expect, it } from "@effect/vitest"
import { Arbitrary, Array as Arr, Effect, Number as Num, Option, Schema, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import { diagonalGaussianLogDensity, sampleDiagonalGaussian } from "../../../src/internal/tpe/multivariateGaussian.js"

const finiteCoordinateArbitrary = Arbitrary.schema(
  Schema.Finite.check(Schema.isBetween({ minimum: Num.multiply(-1, 10), maximum: 10 }))
)

const positiveSigmaArbitrary = Arbitrary.schema(
  Schema.Finite.check(Schema.isBetween({ minimum: 1e-3, maximum: 5 }))
)

const symmetricOffsetArbitrary = Arbitrary.schema(
  Schema.Finite.check(Schema.isBetween({ minimum: Num.multiply(-1, 3), maximum: 3 }))
)

const offsetArbitrary = Arbitrary.schema(Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 8 })))

const rollArbitrary = Arbitrary.schema(
  Schema.Finite.check(Schema.isBetween({ minimum: 1e-6, maximum: Num.subtract(1, 1e-6) }))
)

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
    { arbitrary: { runs: 300 } }
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
    { arbitrary: { runs: 300 } }
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
    { arbitrary: { runs: 300 } }
  )
})
