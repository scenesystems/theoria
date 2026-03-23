import { describe, expect, it } from "@effect/vitest"

import { hypervolume2d } from "../../src/internal/hypervolume.js"
import { dominates } from "../../src/internal/pareto.js"
import { betterByDirection } from "../../src/Study/best.js"

describe("match exhaustive directional behavior", () => {
  it("handles both minimize and maximize branches across directional helpers", () => {
    expect(betterByDirection("minimize", 1, 2)).toBe(true)
    expect(betterByDirection("maximize", 2, 1)).toBe(true)

    expect(dominates([1], [2], ["minimize"])).toBe(true)
    expect(dominates([2], [1], ["maximize"])).toBe(true)

    expect(hypervolume2d([[1, 1]], [2, 2], ["minimize", "minimize"])).toBeGreaterThan(0)
    expect(hypervolume2d([[2, 2]], [0, 0], ["maximize", "maximize"])).toBeGreaterThan(0)
  })
})
