import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option } from "effect"
import type { Schema } from "effect"

import type { Direction } from "../../src/contracts/Direction.js"
import * as Float64 from "../../src/internal/float64.js"
import { hypervolume2d, hypervolumeContribution2d } from "../../src/internal/hypervolume.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

type NumberArray = Schema.Array$<typeof Schema.Number>["Type"]

const numberAt = (values: NumberArray, index: number): number => Arr.get(values, index).pipe(Option.getOrElse(() => 0))

describe("hypervolume kernel", () => {
  it.effect("computes exact 2D hypervolume for a deterministic Pareto front", () =>
    Effect.sync(() => {
      const points = Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1), Arr.make(4, 3))
      const reference = Arr.make(4.4, 4.4)

      expectApprox(hypervolume2d(points, reference), 7.56)
    }))

  it.effect("computes leave-one-out contributions and zeros dominated points", () =>
    Effect.sync(() => {
      const points = Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1), Arr.make(4, 3))
      const reference = Arr.make(4.4, 4.4)
      const contributions = hypervolumeContribution2d(points, reference)

      expect(contributions).toHaveLength(4)
      expectApprox(numberAt(contributions, 0), 0.4)
      expectApprox(numberAt(contributions, 1), 2)
      expectApprox(numberAt(contributions, 2), 1.4)
      expectApprox(numberAt(contributions, 3), 0)
    }))

  it.effect("preserves contribution values under maximize-direction normalization", () =>
    Effect.sync(() => {
      const minimizePoints = Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1), Arr.make(4, 3))
      const minimizeReference = Arr.make(4.4, 4.4)
      const maximizePoints = Arr.map(minimizePoints, (point) => Arr.map(point, Num.negate))
      const maximizeReference = Arr.map(minimizeReference, Num.negate)

      const minimizeContrib = hypervolumeContribution2d(minimizePoints, minimizeReference)
      const maximizeContrib = hypervolumeContribution2d(
        maximizePoints,
        maximizeReference,
        Arr.make<Arr.NonEmptyArray<Direction>>("maximize", "maximize")
      )

      expect(minimizeContrib).toHaveLength(Arr.length(maximizeContrib))

      Arr.forEach(minimizeContrib, (value, index) => {
        expectApprox(numberAt(maximizeContrib, index), value)
      })
    }))
})
