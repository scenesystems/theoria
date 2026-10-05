/**
 * GEPA weighted parent-selection proportionality invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Arbitrary, Array as Arr, Effect, Number as Num, Schema } from "effect"
import { ParentSelectionWeight } from "../../src/internal/gepa/model.js"
import { sampleWeightedParents } from "../../src/internal/gepa/sampling.js"

const weightVectorArbitrary = Arbitrary.array(
  Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10 }))),
  { minLength: 2, maxLength: 6 }
)

const toParentSelectionWeights = (weights: ReadonlyArray<number>): ReadonlyArray<ParentSelectionWeight> =>
  Arr.map(weights, (weight, candidateIndex) => new ParentSelectionWeight({ candidateIndex, weight }))

const countSelections = (samples: ReadonlyArray<number>, candidateIndex: number): number =>
  Arr.length(Arr.filter(samples, (selected) => Num.Equivalence(selected, candidateIndex)))

describe("GEPA selection proportionality", () => {
  it.effect.prop(
    "tracks frontier-holding weights within ±2% over 10,000 seeded draws",
    [weightVectorArbitrary],
    ([weightVector]) =>
      Effect.sync(() => {
        const weights = toParentSelectionWeights(weightVector)
        const draws = sampleWeightedParents(weights, 10000, 42)
        const totalWeight = Arr.reduce(weights, 0, (sum, weight) => Num.sum(sum, weight.weight))
        const sampleCount = Arr.length(draws)
        const withinTolerance = Arr.every(weights, (weight) => {
          const observed = Num.divideUnsafe(countSelections(draws, weight.candidateIndex), sampleCount)
          const expected = Num.divideUnsafe(weight.weight, totalWeight)

          return Num.isLessThanOrEqualTo(Numeric.abs(Num.subtract(observed, expected)), 0.02)
        })

        expect(sampleCount).toBe(10000)
        expect(withinTolerance).toBe(true)
      }),
    { arbitrary: { runs: 10 } }
  )
})
