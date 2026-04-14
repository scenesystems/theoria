import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { abs } from "effect-math/Numeric"

import { hypervolume2d, hypervolumeContribution2d } from "../../src/internal/hypervolume.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe("hypervolume kernel", () => {
  it.effect("computes exact 2D hypervolume for a deterministic Pareto front", () =>
    Effect.sync(() => {
      const points = [
        [1, 4],
        [2, 2],
        [3, 1],
        [4, 3]
      ]
      const reference = [4.4, 4.4]

      expectApprox(hypervolume2d(points, reference), 7.56)
    }))

  it.effect("computes leave-one-out contributions and zeros dominated points", () =>
    Effect.sync(() => {
      const points = [
        [1, 4],
        [2, 2],
        [3, 1],
        [4, 3]
      ]
      const reference = [4.4, 4.4]
      const contributions = hypervolumeContribution2d(points, reference)

      expect(contributions).toHaveLength(4)
      expectApprox(contributions[0] ?? 0, 0.4)
      expectApprox(contributions[1] ?? 0, 2)
      expectApprox(contributions[2] ?? 0, 1.4)
      expectApprox(contributions[3] ?? 0, 0)
    }))

  it.effect("preserves contribution values under maximize-direction normalization", () =>
    Effect.sync(() => {
      const minimizePoints = [
        [1, 4],
        [2, 2],
        [3, 1],
        [4, 3]
      ]
      const minimizeReference = [4.4, 4.4]
      const maximizePoints = minimizePoints.map((point) => [-(point[0] ?? 0), -(point[1] ?? 0)])
      const maximizeReference = [-4.4, -4.4]

      const minimizeContrib = hypervolumeContribution2d(minimizePoints, minimizeReference)
      const maximizeContrib = hypervolumeContribution2d(
        maximizePoints,
        maximizeReference,
        ["maximize", "maximize"]
      )

      expect(minimizeContrib).toHaveLength(maximizeContrib.length)

      minimizeContrib.forEach((value, index) => {
        expectApprox(maximizeContrib[index] ?? 0, value)
      })
    }))
})
