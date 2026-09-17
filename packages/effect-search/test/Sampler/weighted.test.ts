import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Number as Num, Tuple } from "effect"

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
      const reordered = Arr.make(
        { index: 5, weight: Num.negate(1) },
        { index: 9, weight: 0 },
        { index: 2, weight: 0 }
      )

      expect(Sampler.selectWeightedIndexWithPolicy(weights, 11, { zeroWeightFallback: "seed-modulo" })).toBe(9)
      expect(Sampler.selectWeightedIndexWithPolicy(reordered, 11, { zeroWeightFallback: "seed-modulo" })).toBe(9)
    }))

  it.effect("is scale invariant and does not collapse normalized fractional weights", () =>
    Effect.sync(() => {
      const normalized = Arr.make(
        { index: 0, weight: 0.1 },
        { index: 1, weight: 0.3 },
        { index: 2, weight: 0.6 }
      )
      const scaled = Arr.make(
        { index: 0, weight: 1 },
        { index: 1, weight: 3 },
        { index: 2, weight: 6 }
      )
      const normalizedDraws = Sampler.sampleWeightedIndices(normalized, 1000, 1)
      const scaledDraws = Sampler.sampleWeightedIndices(scaled, 1000, 1)

      expect(normalizedDraws).toEqual(scaledDraws)
      expect(Arr.every(normalized, (entry) => Num.greaterThan(countSelections(normalizedDraws, entry.index), 0))).toBe(
        true
      )
    }))

  it.effect("tracks weighted probabilities on a deterministic stream", () =>
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

  it.effect("keeps weighted sampling stable under input reordering", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 10, weight: 1 },
        { index: Num.negate(2), weight: 2 },
        { index: 4, weight: 7 }
      )
      const reordered = Arr.make(
        { index: 4, weight: 7 },
        { index: 10, weight: 1 },
        { index: Num.negate(2), weight: 2 }
      )
      const draws = Sampler.sampleWeightedIndices(weights, 100, 11)

      expect(Sampler.sampleWeightedIndices(reordered, 100, 11)).toEqual(draws)
      expect(Sampler.selectWeightedIndex(reordered, 11)).toBe(Sampler.selectWeightedIndex(weights, 11))
    }))

  it.effect("normalizes finite weights before totals can overflow", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 0, weight: Number.MAX_VALUE },
        { index: 1, weight: Number.MAX_VALUE },
        { index: 2, weight: Num.unsafeDivide(Number.MAX_VALUE, 2) }
      )
      const draws = Sampler.sampleWeightedIndices(weights, 10000, 42)

      expect(countSelections(draws, 0)).toBeGreaterThan(3500)
      expect(countSelections(draws, 1)).toBeGreaterThan(3500)
      expect(countSelections(draws, 2)).toBeGreaterThan(1500)
    }))

  it.effect("excludes non-finite and non-positive weights", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: Num.negate(1), weight: Number.POSITIVE_INFINITY },
        { index: 2, weight: Number.NaN },
        { index: 5, weight: Num.negate(1) },
        { index: 7, weight: Number.NEGATIVE_INFINITY },
        { index: 8, weight: 2 }
      )
      const invalidOnly = Arr.make(
        { index: 4, weight: Number.POSITIVE_INFINITY },
        { index: 2, weight: Number.NaN },
        { index: 3, weight: 0 }
      )

      expect(Sampler.sampleWeightedIndices(weights, 100, 5)).toEqual(Arr.makeBy(100, () => 8))
      expect(Sampler.selectWeightedIndex(invalidOnly, 5)).toBe(2)
    }))

  it.effect("normalizes non-finite and negative draw counts to empty sampling", () =>
    Effect.sync(() => {
      const weights = Arr.make({ index: 0, weight: 1 })

      expect(Sampler.sampleWeightedIndices(weights, Num.negate(1), 7)).toEqual(Arr.empty())
      expect(Sampler.sampleWeightedIndices(weights, Number.NaN, 7)).toEqual(Arr.empty())
    }))

  it.effect("uses successive deterministic draws for pairs and optionally enforces distinct indices", () =>
    Effect.sync(() => {
      const weights = Arr.make(
        { index: 0, weight: 1 },
        { index: 1, weight: 2 },
        { index: 2, weight: 3 }
      )
      const pairA = Sampler.sampleWeightedPair(weights, 42)
      const pairB = Sampler.sampleWeightedPair(weights, 42)
      const sequence = Sampler.sampleWeightedIndices(weights, 2, 42)
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
      expect(pairA).toEqual(sequence)
      expect(Bool.not(Equal.equals(Tuple.getFirst(distinctPair), Tuple.getSecond(distinctPair)))).toBe(true)
      expect(Bool.not(Equal.equals(Tuple.getFirst(zeroWeightDistinctPair), Tuple.getSecond(zeroWeightDistinctPair))))
        .toBe(true)
    }))
})
