import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Match, Number as Num, Option, Order, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { splitMultiObjective } from "../../../src/internal/tpe/split/multiSplit.js"
import { hypervolumeContribution2d } from "../../../src/Pareto.js"
import { nonDominatedRanks } from "../../../src/Pareto.js"
import { multiObjectiveWeights, referencePoint } from "../../../src/Pareto.js"
import { observation } from "../../../src/Sampler.js"
import {
  FixtureRegistryLive,
  loadAllFixtures,
  loadFixture,
  MotpeReferenceFixture,
  MotpeSplitFixture,
  MotpeWeightsFixture
} from "../../helpers/fixtures/index.js"

const expectApprox = (actual: number, expected: number, tolerance = 1e-12): void => {
  expect(Numeric.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Wave 2 / MOTPE selection-depth parity", () => {
  it.effect("FM-6: matches expanded fixture parity for hypervolume contributions and normalized weights", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAllFixtures("motpe-weights.")
      const fixtures = yield* Effect.forEach(
        loaded,
        (fixture) => Schema.decodeUnknown(MotpeWeightsFixture)(fixture)
      )

      Arr.forEach(fixtures, (fixture) => {
        const contributions = hypervolumeContribution2d(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )
        const weights = multiObjectiveWeights(
          fixture.payload.points,
          fixture.payload.referencePoint,
          fixture.payload.directions
        )

        expect(contributions).toHaveLength(Arr.length(fixture.payload.expectedContributions))
        expect(weights).toHaveLength(Arr.length(fixture.payload.expectedWeights))

        Arr.forEach(fixture.payload.expectedContributions, (expected, index) => {
          expectApprox(Arr.get(contributions, index).pipe(Option.getOrElse(() => 0)), expected, 1e-9)
        })

        Arr.forEach(fixture.payload.expectedWeights, (expected, index) => {
          expectApprox(Arr.get(weights, index).pipe(Option.getOrElse(() => 0)), expected, 1e-9)
        })
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-5: computes fixture-backed reference points including zero-to-epsilon handling", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-reference.reference-point")
      const fixture = yield* Schema.decodeUnknown(MotpeReferenceFixture)(loaded)

      Arr.forEach(fixture.payload.cases, (entry) => {
        const reference = referencePoint(Arr.of(entry.worstPoint), entry.directions)

        expect(reference).toHaveLength(Arr.length(entry.expectedReferencePoint))

        Arr.forEach(entry.expectedReferencePoint, (expected, index) => {
          expectApprox(Arr.get(reference, index).pipe(Option.getOrElse(() => 0)), expected, 1e-9)
        })
      })

      const zeroCase = Arr.findFirst(fixture.payload.cases, (entry) => Equal.equals(entry.id, "zero"))

      expect(zeroCase._tag).toBe("Some")

      Option.map(zeroCase, (entry) => {
        const reference = referencePoint(Arr.of(entry.worstPoint), entry.directions)
        expect(Arr.get(reference, 0).pipe(Option.getOrElse(() => 0))).toBeGreaterThanOrEqual(fixture.payload.epsilon)
        expect(Arr.get(reference, 1).pipe(Option.getOrElse(() => 0))).toBeGreaterThanOrEqual(fixture.payload.epsilon)
      })
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("FM-4: preserves rank boundaries and HSSP tie-break membership at split boundaries", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("motpe-split.multi-rank-hssp")
      const fixture = yield* Schema.decodeUnknown(MotpeSplitFixture)(loaded)

      const points = Arr.map(fixture.payload.trials, (trial) => trial.values)
      const ranks = nonDominatedRanks(points, fixture.payload.directions)

      Arr.forEach(fixture.payload.trials, (trial, index) => {
        expect(Arr.get(ranks, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))).toBe(trial.rank)
      })

      const selectedBoundaryRank = Arr.reduce(
        fixture.payload.trials,
        Number.NEGATIVE_INFINITY,
        (acc, trial) =>
          Match.value(
            Arr.some(fixture.payload.expectedBelow, (trialNumber) => Equal.equals(trialNumber, trial.trialNumber))
          ).pipe(
            Match.when(true, () => Num.max(acc, trial.rank)),
            Match.orElse(() => acc)
          )
      )

      const boundaryTrials = Arr.filter(
        fixture.payload.trials,
        (trial) => Equal.equals(trial.rank, selectedBoundaryRank)
      )

      const selectedLowerRankCount = Arr.reduce(
        fixture.payload.trials,
        0,
        (count, trial) =>
          Match.value(Num.lessThan(trial.rank, selectedBoundaryRank)).pipe(
            Match.when(true, () => Num.increment(count)),
            Match.orElse(() => count)
          )
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
        observation(
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
