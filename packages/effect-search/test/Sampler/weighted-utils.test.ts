import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"

const countSelections = (samples: ReadonlyArray<number>, index: number): number =>
  Arr.reduce(
    samples,
    0,
    (count, selected) =>
      selected === index
        ? count + 1
        : count
  )

describe("Sampler weighted utilities", () => {
  it.effect("falls back to the lowest available index when all weights are non-positive", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 4, weight: 0 },
        { index: 2, weight: 0 }
      )

      expect(Sampler.selectWeightedIndex(weights, 91)).toBe(2)
      expect(Sampler.sampleWeightedIndices(weights, 5, 91)).toEqual(Arr.make(2, 2, 2, 2, 2))
    }))

  it.effect("supports seed-modulo fallback policy for all-non-positive weights", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 9, weight: 0 },
        { index: 2, weight: 0 },
        { index: 5, weight: -1 }
      )
      const seed = 11
      const sortedIndices = Arr.make(2, 5, 9)
      const steppedSeed = Sampler.nextDeterministicSeed(Sampler.normalizeDeterministicSeed(seed))
      const expected = sortedIndices[steppedSeed % sortedIndices.length] ?? 0

      expect(Sampler.selectWeightedIndexWithPolicy(weights, seed, { zeroWeightFallback: "seed-modulo" })).toBe(expected)
    }))

  it.effect("tracks weighted probabilities within ±2% over 10,000 deterministic draws", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 0, weight: 1 },
        { index: 1, weight: 3 },
        { index: 2, weight: 6 }
      )
      const draws = Sampler.sampleWeightedIndices(weights, 10000, 42)
      const totalWeight = Arr.reduce(weights, 0, (sum, weight) => sum + weight.weight)
      const sampleCount = draws.length
      const withinTolerance = Arr.every(weights, (weight) => {
        const observed = countSelections(draws, weight.index) / sampleCount
        const expected = weight.weight / totalWeight

        return Math.abs(observed - expected) <= 0.02
      })

      expect(sampleCount).toBe(10000)
      expect(withinTolerance).toBe(true)
    }))

  it.effect("normalizes non-finite and negative draw counts to empty sampling", () =>
    Effect.sync(() => {
      const weights = Arr.make({ index: 0, weight: 1 })

      expect(Sampler.sampleWeightedIndices(weights, -1, 7)).toEqual([])
      expect(Sampler.sampleWeightedIndices(weights, Number.NaN, 7)).toEqual([])
    }))

  it.effect("samples deterministic weighted pairs with optional distinct enforcement", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 0, weight: 1 },
        { index: 1, weight: 2 },
        { index: 2, weight: 3 }
      )
      const pairA = Sampler.sampleWeightedPair(weights, 42)
      const pairB = Sampler.sampleWeightedPair(weights, 42)
      const distinctPair = Sampler.sampleWeightedPair(weights, 42, { distinct: true })
      const zeroWeightDistinctPair = Sampler.sampleWeightedPair(
        Arr.make(
          { index: 0, weight: 0 },
          { index: 1, weight: 0 },
          { index: 2, weight: 0 }
        ),
        7,
        { distinct: true, zeroWeightFallback: "seed-modulo" }
      )

      expect(pairB).toEqual(pairA)
      expect(distinctPair[0]).not.toBe(distinctPair[1])
      expect(zeroWeightDistinctPair[0]).not.toBe(zeroWeightDistinctPair[1])
    }))
})
