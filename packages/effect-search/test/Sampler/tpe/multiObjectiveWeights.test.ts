import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Equal, Function as Fn, Number as Num, Option, Order, Schema } from "effect"

import * as Float64 from "../../../src/internal/float64.js"
import { hypervolumeContribution2d } from "../../../src/internal/hypervolume.js"
import { nonDominatedRanks } from "../../../src/internal/pareto.js"
import { computeMultiObjectiveWeights, computeReferencePoint } from "../../../src/internal/tpe/multiObjectiveWeights.js"
import { makeSuggestCompletedTrial } from "../../../src/Sampler/index.js"
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
  expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

type NumberArray = Schema.Array$<typeof Schema.Number>["Type"]

const numberAt = (values: NumberArray, index: number, fallback = 0): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

describe("Wave 2 / MOTPE selection-depth parity", () => {
  it.effect("FM-6: matches expanded fixture parity for hypervolume contributions and normalized weights", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixtureSchema)(fixture)
      )

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

        expect(contributions).toHaveLength(Arr.length(fixture.payload.expectedContributions))
        expect(weights).toHaveLength(Arr.length(fixture.payload.expectedWeights))

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(numberAt(contributions, index), expected, 1e-9)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(numberAt(weights, index), expected, 1e-9)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-5: computes fixture-backed reference points including zero-to-epsilon handling", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-reference.reference-point")
      const fixture = yield* Schema.decodeUnknown(MotpeReferenceFixtureSchema)(loaded)

      Arr.forEach(fixture.payload.cases, (entry) => {
        const reference = computeReferencePoint(Arr.of(entry.worstPoint), entry.directions)

        expect(reference).toHaveLength(Arr.length(entry.expectedReferencePoint))

        Arr.forEach(entry.expectedReferencePoint, (expected, index) => {
          expectApprox(numberAt(reference, index), expected, 1e-9)
        })
      })

      const zeroCase = Arr.findFirst(fixture.payload.cases, (entry) => Equal.equals(entry.id, "zero"))

      expect(zeroCase._tag).toBe("Some")

      Option.match(zeroCase, {
        onNone: Fn.constVoid,
        onSome: (entry) => {
          const reference = computeReferencePoint(Arr.of(entry.worstPoint), entry.directions)
          expect(numberAt(reference, 0)).toBeGreaterThanOrEqual(fixture.payload.epsilon)
          expect(numberAt(reference, 1)).toBeGreaterThanOrEqual(fixture.payload.epsilon)
        }
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-4: preserves rank boundaries and HSSP tie-break membership at split boundaries", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-split.multi-rank-hssp")
      const fixture = yield* Schema.decodeUnknown(MotpeSplitFixtureSchema)(loaded)

      const points = Arr.map(fixture.payload.trials, (trial) => trial.values)
      const ranks = nonDominatedRanks(points, fixture.payload.directions)

      Arr.forEach(fixture.payload.trials, (trial, index) => {
        expect(numberAt(ranks, index, Number.POSITIVE_INFINITY)).toBe(trial.rank)
      })

      const selectedBoundaryRank = Arr.reduce(
        fixture.payload.trials,
        Number.NEGATIVE_INFINITY,
        (acc, trial) =>
          Boolean.match(
            Arr.some(fixture.payload.expectedBelow, (trialNumber) => Equal.equals(trialNumber, trial.trialNumber)),
            {
              onFalse: () => acc,
              onTrue: () => Num.max(acc, trial.rank)
            }
          )
      )

      const boundaryTrials = Arr.filter(
        fixture.payload.trials,
        (trial) => Num.Equivalence(trial.rank, selectedBoundaryRank)
      )

      const selectedLowerRankCount = Arr.reduce(
        fixture.payload.trials,
        0,
        (count, trial) =>
          Boolean.match(Num.lessThan(trial.rank, selectedBoundaryRank), {
            onFalse: () => count,
            onTrue: () => Num.increment(count)
          })
      )
      const neededFromBoundary = Num.max(
        Num.subtract(fixture.payload.nBelow, selectedLowerRankCount),
        0
      )
      const rankedBoundaryTrials = Arr.sortBy(
        Order.mapInput(
          Order.number,
          (trial: (typeof boundaryTrials)[number]) => Num.negate(trial.hsspScore)
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
        makeSuggestCompletedTrial(
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
          (trial) => Arr.some(boundaryTrials, (candidate) => Equal.equals(candidate.trialNumber, trial.trialNumber))
        ),
        (trial) => trial.trialNumber
      )

      expect(actualBoundarySelection).toEqual(expectedBoundarySelection)
      expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(fixture.payload.expectedBelow)
      expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(fixture.payload.expectedAbove)
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
