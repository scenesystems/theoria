/**
 * GEPA weighted parent-selection proportionality invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import { Arbitrary, Array as Arr, Effect, Schema } from "effect"
import { ParentSelectionWeight } from "../../src/internal/gepa/model.js"
import { sampleWeightedParents } from "../../src/internal/gepa/sampling.js"

const weightVectorArbitrary = Arbitrary.array(
  Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 }))),
  { minLength: 2, maxLength: 6 }
)

const toParentSelectionWeights = (weights: ReadonlyArray<number>): ReadonlyArray<ParentSelectionWeight> =>
  Arr.map(weights, (weight, candidateIndex) => new ParentSelectionWeight({ candidateIndex, weight }))

const countSelections = (samples: ReadonlyArray<number>, candidateIndex: number): number =>
  Arr.reduce(
    samples,
    0,
    (count, selected) =>
      selected === candidateIndex
        ? count + 1
        : count
  )

describe("GEPA selection proportionality", () => {
  it.effect.prop(
    "tracks frontier-holding weights within ±2% over 10,000 seeded draws",
    [weightVectorArbitrary],
    ([weightVector]) =>
      Effect.sync(() => {
        const weights = toParentSelectionWeights(weightVector)
        const draws = sampleWeightedParents(weights, 10000, 42)
        const totalWeight = Arr.reduce(weights, 0, (sum, weight) => sum + weight.weight)
        const sampleCount = draws.length
        const withinTolerance = Arr.every(weights, (weight) => {
          const observed = countSelections(draws, weight.candidateIndex) / sampleCount
          const expected = weight.weight / totalWeight

          return Math.abs(observed - expected) <= 0.02
        })

        expect(sampleCount).toBe(10000)
        expect(withinTolerance).toBe(true)
      }),
    { arbitrary: { runs: 10 } }
  )
})
