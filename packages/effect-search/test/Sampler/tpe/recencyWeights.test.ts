import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import { defaultWeights } from "../../../src/internal/tpe/recencyWeights.js"

describe("tpe recency weights", () => {
  it.effect("returns all ones when observations are below 25", () =>
    Effect.sync(() => {
      expect(defaultWeights(5)).toEqual([1, 1, 1, 1, 1])
    }))

  it.effect("returns all ones at the 25-observation boundary", () =>
    Effect.sync(() => {
      expect(defaultWeights(25)).toEqual(Arr.makeBy(25, () => 1))
    }))

  it.effect("ramps early observations and keeps latest 25 flat at one", () =>
    Effect.sync(() => {
      const weights = defaultWeights(50)
      const start = 1 / 50
      const step = (1 - start) / 24

      expect(weights).toHaveLength(50)

      weights.slice(0, 25).forEach((weight, index) => {
        const expected = start + step * index
        expect(weight).toBeCloseTo(expected, 12)
      })

      weights.slice(25, 50).forEach((weight) => {
        expect(weight).toBe(1)
      })
    }))

  it.effect("always returns a positive total weight", () =>
    Effect.sync(() => {
      const sum = defaultWeights(50).reduce((total, value) => total + value, 0)
      expect(sum).toBeGreaterThan(0)
    }))
})
