import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import * as Rng from "../../src/internal/rng.js"

const drawFloatSequence = (seed: number, count: number, low = 0, high = 1) => {
  const rng = Rng.make(seed)
  const draws = Arr.makeBy(count, (index) => index)

  return Effect.forEach(draws, () => Rng.nextFloat(rng, low, high))
}

const drawIntSequence = (seed: number, count: number, low: number, high: number) => {
  const rng = Rng.make(seed)
  const draws = Arr.makeBy(count, (index) => index)

  return Effect.forEach(draws, () => Rng.nextInt(rng, low, high))
}

describe("internal rng", () => {
  it.effect("produces identical sequences for identical seeds", () =>
    Effect.gen(function*() {
      const left = yield* drawFloatSequence(42, 100)
      const right = yield* drawFloatSequence(42, 100)

      expect(left).toEqual(right)
    }))

  it.effect("produces different sequences for different seeds", () =>
    Effect.gen(function*() {
      const left = yield* drawFloatSequence(42, 100)
      const right = yield* drawFloatSequence(43, 100)

      expect(left).not.toEqual(right)
    }))

  it.effect("keeps nextFloat draws within inclusive bounds", () =>
    Effect.gen(function*() {
      const low = -3.25
      const high = 7.5
      const draws = yield* drawFloatSequence(99, 1000, low, high)

      draws.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(low)
        expect(value).toBeLessThanOrEqual(high)
      })
    }))

  it.effect("keeps nextInt draws within inclusive integer bounds", () =>
    Effect.gen(function*() {
      const low = 3
      const high = 9
      const draws = yield* drawIntSequence(123, 2000, low, high)

      draws.forEach((value) => {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(low)
        expect(value).toBeLessThanOrEqual(high)
      })

      expect(draws.includes(low)).toBe(true)
      expect(draws.includes(high)).toBe(true)
    }))
})
