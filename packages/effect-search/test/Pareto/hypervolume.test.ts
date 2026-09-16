import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Direction from "../../src/Direction.js"
import { hypervolume2d, hypervolumeContribution2d } from "../../src/Pareto.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(Numeric.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

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
      expectApprox(Arr.get(contributions, 0).pipe(Option.getOrElse(() => 0)), 0.4)
      expectApprox(Arr.get(contributions, 1).pipe(Option.getOrElse(() => 0)), 2)
      expectApprox(Arr.get(contributions, 2).pipe(Option.getOrElse(() => 0)), 1.4)
      expectApprox(Arr.get(contributions, 3).pipe(Option.getOrElse(() => 0)), 0)
    }))

  it.effect("preserves contribution values under maximize-direction normalization", () =>
    Effect.sync(() => {
      const minimizePoints = Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1), Arr.make(4, 3))
      const minimizeReference = Arr.make(4.4, 4.4)
      const maximizePoints = Arr.map(minimizePoints, (point) =>
        Arr.make(
          Num.negate(Arr.get(point, 0).pipe(Option.getOrElse(() => 0))),
          Num.negate(Arr.get(point, 1).pipe(Option.getOrElse(() => 0)))
        ))
      const maximizeReference = Arr.make(Num.negate(4.4), Num.negate(4.4))

      const minimizeContrib = hypervolumeContribution2d(minimizePoints, minimizeReference)
      const maximizeContrib = hypervolumeContribution2d(
        maximizePoints,
        maximizeReference,
        Tuple.make(Direction.maximize, Direction.maximize)
      )

      expect(minimizeContrib).toHaveLength(Arr.length(maximizeContrib))

      Arr.forEach(minimizeContrib, (value, index) => {
        expectApprox(Arr.get(maximizeContrib, index).pipe(Option.getOrElse(() => 0)), value)
      })
    }))
})
