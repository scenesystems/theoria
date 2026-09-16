import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num } from "effect"

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
      const start = Num.unsafeDivide(1, 50)
      const step = Num.unsafeDivide(Num.subtract(1, start), 24)

      expect(weights).toHaveLength(50)

      Arr.forEach(Arr.take(weights, 25), (weight, index) => {
        const expected = Num.sum(start, Num.multiply(step, index))
        expect(weight).toBeCloseTo(expected, 12)
      })

      Arr.forEach(Arr.take(Arr.drop(weights, 25), 25), (weight) => {
        expect(weight).toBe(1)
      })
    }))

  it.effect("always returns a positive total weight", () =>
    Effect.sync(() => {
      const sum = Arr.reduce(defaultWeights(50), 0, (total, value) => Num.sum(total, value))
      expect(sum).toBeGreaterThan(0)
    }))
})
