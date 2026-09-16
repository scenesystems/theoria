import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import * as Sampler from "../../src/Sampler.js"

const countSelections = (samplesInput: Iterable<number>, index: number): number => {
  const samples = Arr.fromIterable(samplesInput)
  return Arr.reduce(
    samples,
    0,
    (count, selected) =>
      Match.value(Equal.equals(selected, index)).pipe(
        Match.when(true, () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )
}

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
        { index: 5, weight: Num.negate(1) }
      )
      const seed = 11
      const sortedIndices = Arr.make(2, 5, 9)
      const steppedSeed = Sampler.nextDeterministicSeed(Sampler.normalizeDeterministicSeed(seed))
      const expected = Arr.get(sortedIndices, Num.remainder(steppedSeed, Arr.length(sortedIndices))).pipe(
        Option.getOrElse(() => 0)
      )

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
      const totalWeight = Arr.reduce(weights, 0, (sum, weight) => Num.sum(sum, weight.weight))
      const sampleCount = Arr.length(draws)
      const withinTolerance = Arr.every(weights, (weight) => {
        const observed = Num.unsafeDivide(countSelections(draws, weight.index), sampleCount)
        const expected = Num.unsafeDivide(weight.weight, totalWeight)

        return Num.lessThanOrEqualTo(Numeric.abs(Num.subtract(observed, expected)), 0.02)
      })

      expect(sampleCount).toBe(10000)
      expect(withinTolerance).toBe(true)
    }))

  it.effect("normalizes non-finite and negative draw counts to empty sampling", () =>
    Effect.sync(() => {
      const weights = Arr.make({ index: 0, weight: 1 })

      expect(Sampler.sampleWeightedIndices(weights, Num.negate(1), 7)).toEqual(Arr.empty())
      expect(Sampler.sampleWeightedIndices(weights, Number.NaN, 7)).toEqual(Arr.empty())
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
      expect(Bool.not(Equal.equals(Tuple.getFirst(distinctPair), Tuple.getSecond(distinctPair)))).toBe(true)
      expect(Bool.not(Equal.equals(Tuple.getFirst(zeroWeightDistinctPair), Tuple.getSecond(zeroWeightDistinctPair))))
        .toBe(true)
    }))
})
