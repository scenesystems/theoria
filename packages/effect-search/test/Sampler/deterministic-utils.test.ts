import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Number as Num } from "effect"
import type { Schema } from "effect"

import * as Sampler from "../../src/Sampler/index.js"

const steppedSeeds = (
  seed: number,
  steps: number,
  acc: Schema.Array$<typeof Schema.Number>["Type"] = Arr.empty<number>()
): Schema.Array$<typeof Schema.Number>["Type"] =>
  Boolean.match(Num.lessThanOrEqualTo(steps, 0), {
    onFalse: () => {
      const next = Sampler.nextDeterministicSeed(seed)

      return steppedSeeds(next, Num.decrement(steps), Arr.append(acc, next))
    },
    onTrue: () => acc
  })

describe("Sampler deterministic utilities", () => {
  it.effect("normalizes non-finite and non-positive values to deterministic positive seeds", () =>
    Effect.sync(() => {
      expect(Sampler.normalizeDeterministicSeed(0)).toBe(1)
      expect(Sampler.normalizeDeterministicSeed(-4.9)).toBe(4)
      expect(Sampler.normalizeDeterministicSeed(Number.NaN)).toBe(1)
      expect(Sampler.normalizeDeterministicSeed(Number.POSITIVE_INFINITY)).toBe(1)
    }))

  it.effect("keeps canonical LCG stepping stable", () =>
    Effect.sync(() => {
      expect(steppedSeeds(Sampler.normalizeDeterministicSeed(1), 3)).toEqual([
        1015568748,
        1586005467,
        2165703038
      ])
    }))

  it.effect("builds deterministic indices and bounded counts", () =>
    Effect.sync(() => {
      expect(Sampler.buildIndices(5)).toEqual(Arr.make(0, 1, 2, 3, 4))
      expect(Sampler.buildIndices(3.9)).toEqual(Arr.make(0, 1, 2))
      expect(Sampler.buildIndices(-4)).toEqual([])
      expect(Sampler.buildIndices(Number.POSITIVE_INFINITY)).toEqual([])
      expect(Sampler.sampleBoundedCount(42, 7)).toBeGreaterThanOrEqual(1)
      expect(Sampler.sampleBoundedCount(42, 7)).toBeLessThanOrEqual(7)
    }))

  it.effect("shuffles values deterministically by seed", () =>
    Effect.sync(() => {
      const values = Arr.make(1, 2, 3, 4, 5)

      expect(Sampler.shuffleBySeed(values, 42)).toEqual(Arr.make(2, 4, 1, 5, 3))
      expect(Sampler.shuffleBySeed(values, 42)).toEqual(Sampler.shuffleBySeed(values, 42))
      expect(Sampler.shuffleBySeed(values, 43)).not.toEqual(Sampler.shuffleBySeed(values, 42))
    }))
})
