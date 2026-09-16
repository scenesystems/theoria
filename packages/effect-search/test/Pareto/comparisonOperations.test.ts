import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Tuple } from "effect"

import * as Direction from "../../src/Direction.js"
import { betterByDirection } from "../../src/internal/optimization/best.js"
import { dominates, hypervolume2d } from "../../src/Pareto.js"

describe("match exhaustive directional behavior", () => {
  it.effect("handles both minimize and maximize branches across directional helpers", () =>
    Effect.sync(() => {
      expect(betterByDirection("minimize", 1, 2)).toBe(true)
      expect(betterByDirection("maximize", 2, 1)).toBe(true)

      expect(dominates(Arr.of(1), Arr.of(2), Arr.of("minimize"))).toBe(true)
      expect(dominates(Arr.of(2), Arr.of(1), Arr.of("maximize"))).toBe(true)

      expect(hypervolume2d(
        Arr.of(Arr.make(1, 1)),
        Arr.make(2, 2),
        Tuple.make(Direction.minimize, Direction.minimize)
      )).toBeGreaterThan(0)
      expect(hypervolume2d(
        Arr.of(Arr.make(2, 2)),
        Arr.make(0, 0),
        Tuple.make(Direction.maximize, Direction.maximize)
      )).toBeGreaterThan(0)
    }))
})
