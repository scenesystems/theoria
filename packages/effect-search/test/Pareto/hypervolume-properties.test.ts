import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../../src/internal/float64.js"
import * as Pareto from "../../src/Pareto/index.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const isNonNaN = Schema.is(Schema.NonNaN)

const numberAt = (values: Pareto.ObjectiveWeights, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => 0))

describe("Pareto hypervolume properties", () => {
  it.effect("is monotonic when adding points under a fixed reference", () =>
    Effect.sync(() => {
      const reference = Arr.make(4.4, 4.4)
      const baseline = Arr.make(Arr.make(2, 3), Arr.make(3, 2))
      const extended = Arr.append(baseline, Arr.make(1.5, 1.5))

      const baseHv = Pareto.hypervolume2d(baseline, reference)
      const extendedHv = Pareto.hypervolume2d(extended, reference)

      expect(extendedHv).toBeGreaterThanOrEqual(baseHv)
    }))

  it.effect("returns non-negative contributions and zero for dominated points", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(1, 4),
        Arr.make(2, 2),
        Arr.make(3, 1),
        Arr.make(4, 3)
      )
      const reference = Arr.make(4.4, 4.4)
      const contributions = Pareto.hypervolumeContribution2d(points, reference)

      expect(contributions).toHaveLength(Arr.length(points))
      expect(Arr.every(contributions, (value) => Boolean.and(isNonNaN(value), Num.greaterThanOrEqualTo(value, 0))))
        .toBe(true)
      expectApprox(numberAt(contributions, 3), 0)
    }))

  it.effect("matches leave-one-out contribution identity on the non-dominated front", () =>
    Effect.sync(() => {
      const points = Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1))
      const reference = Arr.make(4.4, 4.4)
      const total = Pareto.hypervolume2d(points, reference)
      const contributions = Pareto.hypervolumeContribution2d(points, reference)

      Arr.forEach(points, (_point, index) => {
        const withoutPoint = Arr.filter(points, (_entry, pointIndex) => Boolean.not(Num.Equivalence(pointIndex, index)))
        const leaveOneOut = Pareto.hypervolume2d(withoutPoint, reference)

        expectApprox(Num.sum(numberAt(contributions, index), leaveOneOut), total)
      })
    }))
})
