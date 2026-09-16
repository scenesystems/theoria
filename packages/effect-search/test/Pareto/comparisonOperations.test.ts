import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { betterByDirection } from "../../src/internal/study/best.js"
import { dominates, hypervolume2d } from "../../src/Pareto.js"

describe("match exhaustive directional behavior", () => {
  it.effect("handles both minimize and maximize branches across directional helpers", () =>
    Effect.sync(() => {
      expect(betterByDirection("minimize", 1, 2)).toBe(true)
      expect(betterByDirection("maximize", 2, 1)).toBe(true)

      expect(dominates([1], [2], ["minimize"])).toBe(true)
      expect(dominates([2], [1], ["maximize"])).toBe(true)

      expect(hypervolume2d([[1, 1]], [2, 2], ["minimize", "minimize"])).toBeGreaterThan(0)
      expect(hypervolume2d([[2, 2]], [0, 0], ["maximize", "maximize"])).toBeGreaterThan(0)
    }))
})
