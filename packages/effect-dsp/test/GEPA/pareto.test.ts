/**
 * GEPA Pareto kernel contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Effect, Number as Num, Option, Schema } from "effect"
import {
  deriveParetoKernelSnapshot,
  dominatesCandidateVector,
  nonDominatedCandidateIndices
} from "../../src/internal/gepa/frontier.js"
import { ExampleFrontierHolding, ParentSelectionWeight } from "../../src/internal/gepa/model.js"
import { sampleWeightedParents } from "../../src/internal/gepa/sampling.js"
import { GepaParetoScoreMatrixFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

const loadScoreMatrixFixture = (
  name: "dspy.gepa.pareto.score-matrix.basic" | "dspy.gepa.pareto.score-matrix.ties"
) =>
  loadFixture(name).pipe(
    Effect.flatMap(Schema.decodeUnknown(GepaParetoScoreMatrixFixtureSchema))
  )

const scoreVectorAt = (
  scoreMatrix: ReadonlyArray<ReadonlyArray<number>>,
  candidateIndex: number
): ReadonlyArray<number> => Arr.get(scoreMatrix, candidateIndex).pipe(Option.getOrElse(() => Arr.empty<number>()))

const countSelections = (samples: ReadonlyArray<number>, candidateIndex: number): number =>
  Arr.reduce(
    samples,
    0,
    (count, selected) =>
      Bool.match(Num.Equivalence(selected, candidateIndex), {
        onFalse: () => count,
        onTrue: () => Num.increment(count)
      })
  )

describe("GEPA Pareto kernel", () => {
  it.effect("derives fixture-backed frontier indices, dominated candidates, and per-example holdings", () =>
    Effect.gen(function*() {
      const basicFixture = yield* loadScoreMatrixFixture("dspy.gepa.pareto.score-matrix.basic")
      const tiesFixture = yield* loadScoreMatrixFixture("dspy.gepa.pareto.score-matrix.ties")
      const basicSnapshot = deriveParetoKernelSnapshot(basicFixture.payload.scores)
      const tiesSnapshot = deriveParetoKernelSnapshot(tiesFixture.payload.scores)

      expect(basicSnapshot.frontierIndices).toEqual(basicFixture.payload.expectedFrontierIndices)
      expect(basicSnapshot.dominatedIndices).toEqual(basicFixture.payload.expectedDominatedIndices)
      expect(basicSnapshot.exampleHoldings).toEqual(
        Arr.map(basicFixture.payload.expectedHoldings, (holding) => new ExampleFrontierHolding(holding))
      )
      expect(basicSnapshot.parentWeights).toEqual(
        Arr.map(basicFixture.payload.expectedSelectionWeights, (weight) => new ParentSelectionWeight(weight))
      )

      expect(tiesSnapshot.frontierIndices).toEqual(tiesFixture.payload.expectedFrontierIndices)
      expect(tiesSnapshot.dominatedIndices).toEqual(tiesFixture.payload.expectedDominatedIndices)
      expect(tiesSnapshot.exampleHoldings).toEqual(
        Arr.map(tiesFixture.payload.expectedHoldings, (holding) => new ExampleFrontierHolding(holding))
      )
      expect(tiesSnapshot.parentWeights).toEqual(
        Arr.map(tiesFixture.payload.expectedSelectionWeights, (weight) => new ParentSelectionWeight(weight))
      )
    }))

  it.effect("uses maximize-all-examples dominance semantics", () =>
    Effect.gen(function*() {
      const fixture = yield* loadScoreMatrixFixture("dspy.gepa.pareto.score-matrix.basic")
      const scoreMatrix = fixture.payload.scores

      expect(nonDominatedCandidateIndices(scoreMatrix)).toEqual(fixture.payload.expectedFrontierIndices)
      expect(dominatesCandidateVector(scoreVectorAt(scoreMatrix, 0), scoreVectorAt(scoreMatrix, 3))).toBe(true)
      expect(dominatesCandidateVector(scoreVectorAt(scoreMatrix, 1), scoreVectorAt(scoreMatrix, 0))).toBe(false)
      expect(dominatesCandidateVector(scoreVectorAt(scoreMatrix, 2), scoreVectorAt(scoreMatrix, 1))).toBe(false)
    }))

  it.effect("samples parent candidates proportional to frontier-holding weights within ±2% over 10,000 draws", () =>
    Effect.gen(function*() {
      const fixture = yield* loadScoreMatrixFixture("dspy.gepa.pareto.score-matrix.basic")
      const snapshot = deriveParetoKernelSnapshot(fixture.payload.scores)
      const samples = sampleWeightedParents(
        snapshot.parentWeights,
        fixture.payload.sampling.draws,
        fixture.payload.sampling.seed
      )
      const positiveWeights = Arr.filter(snapshot.parentWeights, (weight) => Num.greaterThan(weight.weight, 0))
      const totalWeight = Arr.reduce(positiveWeights, 0, (sum, weight) => Num.sum(sum, weight.weight))
      const sampleCount = Arr.length(samples)
      const withinTolerance = Arr.every(positiveWeights, (weight) => {
        const observed = Num.unsafeDivide(countSelections(samples, weight.candidateIndex), sampleCount)
        const expected = Num.unsafeDivide(weight.weight, totalWeight)

        return Num.lessThanOrEqualTo(
          Numeric.abs(Num.subtract(observed, expected)),
          fixture.payload.sampling.tolerance
        )
      })
      const zeroWeightsNeverSelected = Arr.every(
        Arr.filter(snapshot.parentWeights, (weight) => Num.Equivalence(weight.weight, 0)),
        (weight) => Num.Equivalence(countSelections(samples, weight.candidateIndex), 0)
      )

      expect(sampleCount).toBe(fixture.payload.sampling.draws)
      expect(withinTolerance).toBe(true)
      expect(zeroWeightsNeverSelected).toBe(true)
    }))
})
