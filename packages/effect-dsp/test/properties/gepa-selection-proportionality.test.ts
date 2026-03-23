/**
 * GEPA weighted parent-selection proportionality invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import fc from "fast-check"
import { ParentSelectionWeight } from "../../src/optimizers/GEPA/model.js"
import { sampleWeightedParents } from "../../src/optimizers/GEPA/pareto.js"
import { GepaSelectionWeightsFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

const weightVectorArbitrary = fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 6 })

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
  it.effect("matches the committed dspy.gepa.selection.weights.seed-42 distribution contract", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("dspy.gepa.selection.weights.seed-42").pipe(
        Effect.flatMap(Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema))
      )
      const weights = Arr.map(
        fixture.payload.weights,
        (weight) => new ParentSelectionWeight({ candidateIndex: weight.candidateIndex, weight: weight.weight })
      )
      const draws = sampleWeightedParents(weights, fixture.payload.draws, fixture.payload.seed)
      const sampleCount = draws.length

      expect(sampleCount).toBe(fixture.payload.draws)

      yield* Effect.forEach(
        fixture.payload.expectedProbabilities,
        (expectedProbability) =>
          Effect.sync(() => {
            const observed = countSelections(draws, expectedProbability.candidateIndex) / sampleCount
            expect(Math.abs(observed - expectedProbability.probability)).toBeLessThanOrEqual(fixture.payload.tolerance)
          }),
        { discard: true }
      )
    }))

  it.effect("tracks frontier-holding weights within ±2% over 10,000 seeded draws", () =>
    Effect.gen(function*() {
      const sampledWeightVectors = fc.sample(weightVectorArbitrary, { numRuns: 10 })

      yield* Effect.forEach(
        sampledWeightVectors,
        (weightVector) =>
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
        { discard: true }
      )
    }))
})
