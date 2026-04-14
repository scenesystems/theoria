import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Order, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import { hypervolumeContribution2d } from "../../../src/internal/hypervolume.js"
import { nonDominatedRanks } from "../../../src/internal/pareto.js"
import { computeMultiObjectiveWeights, computeReferencePoint } from "../../../src/internal/tpe/multiObjectiveWeights.js"
import { SuggestCompletedTrial } from "../../../src/Sampler/index.js"
import { splitMultiObjective } from "../../../src/samplers/Tpe/split/multiSplit.js"
import {
  FixtureRegistryLive,
  loadAllFixtures,
  loadFixture,
  MotpeReferenceFixtureSchema,
  MotpeSplitFixtureSchema,
  MotpeWeightsFixtureSchema
} from "../../helpers/fixtures.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe("Wave 2 / MOTPE selection-depth parity", () => {
  it.effect("FM-6: matches expanded fixture parity for hypervolume contributions and normalized weights", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixtureSchema)(fixture)
      )

      expect(fixtures.length).toBeGreaterThanOrEqual(3)

      Arr.forEach(fixtures, (fixture) => {
        const contributions = hypervolumeContribution2d(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )
        const weights = computeMultiObjectiveWeights(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )

        expect(contributions).toHaveLength(fixture.payload.expectedContributions.length)
        expect(weights).toHaveLength(fixture.payload.expectedWeights.length)

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(contributions[index] ?? 0, expected, 1e-9)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(weights[index] ?? 0, expected, 1e-9)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-5: computes fixture-backed reference points including zero-to-epsilon handling", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-reference.reference-point")
      const fixture = yield* Schema.decodeUnknown(MotpeReferenceFixtureSchema)(loaded)

      Arr.forEach(fixture.payload.cases, (entry) => {
        const reference = computeReferencePoint([entry.worstPoint], entry.directions)

        expect(reference).toHaveLength(entry.expectedReferencePoint.length)

        Arr.forEach(entry.expectedReferencePoint, (expected, index) => {
          expectApprox(reference[index] ?? 0, expected, 1e-9)
        })
      })

      const zeroCase = Arr.findFirst(fixture.payload.cases, (entry) => entry.id === "zero")

      expect(zeroCase._tag).toBe("Some")

      if (zeroCase._tag === "Some") {
        const reference = computeReferencePoint([zeroCase.value.worstPoint], zeroCase.value.directions)
        expect(reference[0]).toBeGreaterThanOrEqual(fixture.payload.epsilon)
        expect(reference[1]).toBeGreaterThanOrEqual(fixture.payload.epsilon)
      }
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-4: preserves rank boundaries and HSSP tie-break membership at split boundaries", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-split.multi-rank-hssp")
      const fixture = yield* Schema.decodeUnknown(MotpeSplitFixtureSchema)(loaded)

      const points = Arr.map(fixture.payload.trials, (trial) => trial.values)
      const ranks = nonDominatedRanks(points, fixture.payload.directions)

      Arr.forEach(fixture.payload.trials, (trial, index) => {
        expect(ranks[index] ?? Number.POSITIVE_INFINITY).toBe(trial.rank)
      })

      const selectedBoundaryRank = Arr.reduce(
        fixture.payload.trials,
        Number.NEGATIVE_INFINITY,
        (acc, trial) =>
          Arr.some(fixture.payload.expectedBelow, (trialNumber) => trialNumber === trial.trialNumber)
            ? Num.max(acc, trial.rank)
            : acc
      )

      const boundaryTrials = Arr.filter(
        fixture.payload.trials,
        (trial) => trial.rank === selectedBoundaryRank
      )

      const selectedLowerRankCount = Arr.reduce(
        fixture.payload.trials,
        0,
        (count, trial) => count + (trial.rank < selectedBoundaryRank ? 1 : 0)
      )
      const neededFromBoundary = Num.max(
        fixture.payload.nBelow - selectedLowerRankCount,
        0
      )
      const rankedBoundaryTrials = Arr.sortBy(
        Order.mapInput(
          Order.number,
          (trial: (typeof boundaryTrials)[number]) => -trial.hsspScore
        ),
        Order.mapInput(
          Order.number,
          (trial: (typeof boundaryTrials)[number]) => trial.trialNumber
        )
      )(boundaryTrials)
      const expectedBoundarySelection = Arr.map(
        Arr.take(rankedBoundaryTrials, neededFromBoundary),
        (trial) => trial.trialNumber
      )

      const completed = Arr.map(fixture.payload.trials, (trial) =>
        SuggestCompletedTrial.fromObservation(
          trial.trialNumber,
          { trialNumber: trial.trialNumber, feasible: trial.feasible },
          trial.values
        ))
      const split = splitMultiObjective(
        completed,
        fixture.payload.directions,
        fixture.payload.nBelow
      )
      const actualBoundarySelection = Arr.map(
        Arr.filter(
          split.below,
          (trial) => Arr.some(boundaryTrials, (candidate) => candidate.trialNumber === trial.trialNumber)
        ),
        (trial) => trial.trialNumber
      )

      expect(actualBoundarySelection).toEqual(expectedBoundarySelection)
      expect(split.below.map((trial) => trial.trialNumber)).toEqual(fixture.payload.expectedBelow)
      expect(split.above.map((trial) => trial.trialNumber)).toEqual(fixture.payload.expectedAbove)
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
