import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import type { Direction } from "../../../src/contracts/Direction.js"
import { PrunedIntermediateValue, prunedTrialScore } from "../../../src/internal/tpe/prunedScore.js"
import {
  CompletedTrialForSplit,
  type CompletedTrialsForSplit,
  splitTrials
} from "../../../src/internal/tpe/splitTrials.js"
import {
  FixtureRegistryLive,
  loadFixture,
  type SplitTrialsFixture,
  SplitTrialsFixtureSchema
} from "../../helpers/fixtures.js"

type SplitFixtureTrial = SplitTrialsFixture["payload"]["cases"][number]["trials"][number]
type TraceValue = SplitFixtureTrial["intermediateValues"][number]["value"]

const traceValueToNumber = (value: TraceValue): number =>
  Match.value(value).pipe(
    Match.when("NaN", () => Number.NaN),
    Match.when("Infinity", () => Number.POSITIVE_INFINITY),
    Match.when("-Infinity", () => Number.NEGATIVE_INFINITY),
    Match.orElse((resolved) => resolved)
  )

const optionalTraceValueToNumber = (
  value: SplitFixtureTrial["value"] | SplitFixtureTrial["liarValue"]
): Option.Option<number> => Option.fromNullable(value).pipe(Option.map(traceValueToNumber))

const directionalScore = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Num.negate(value)),
    Match.when("minimize", () => value),
    Match.exhaustive
  )

const normalizedIntermediateValues = (
  trial: SplitFixtureTrial
): Schema.Array$<typeof PrunedIntermediateValue>["Type"] =>
  Arr.map(trial.intermediateValues, (entry) =>
    new PrunedIntermediateValue({
      step: entry.step,
      value: traceValueToNumber(entry.value)
    }))

const splitTrialFromFixture = (
  direction: Direction,
  trial: SplitFixtureTrial
): Option.Option<CompletedTrialForSplit> =>
  Match.value(trial.state).pipe(
    Match.when("complete", () =>
      optionalTraceValueToNumber(trial.value).pipe(
        Option.map((value) =>
          new CompletedTrialForSplit({
            trialNumber: trial.trialNumber,
            config: { trialNumber: trial.trialNumber, state: trial.state },
            value: directionalScore(direction, value),
            sortStep: -1
          })
        )
      )),
    Match.when("running", () =>
      optionalTraceValueToNumber(trial.liarValue).pipe(
        Option.map((value) =>
          new CompletedTrialForSplit({
            trialNumber: trial.trialNumber,
            config: { trialNumber: trial.trialNumber, state: trial.state },
            value: directionalScore(direction, value),
            sortStep: -1
          })
        )
      )),
    Match.when("pruned", () => {
      const score = prunedTrialScore(normalizedIntermediateValues(trial), direction)

      return Option.some(
        new CompletedTrialForSplit({
          trialNumber: trial.trialNumber,
          config: { trialNumber: trial.trialNumber, state: trial.state },
          value: score.value,
          sortStep: score.step
        })
      )
    }),
    Match.exhaustive
  )

const splitTrialsFromFixtureCase = (
  direction: Direction,
  trials: SplitTrialsFixture["payload"]["cases"][number]["trials"]
): CompletedTrialsForSplit =>
  Arr.flatMap(trials, (trial) =>
    splitTrialFromFixture(direction, trial).pipe(
      Option.match({
        onNone: () => Arr.empty<CompletedTrialForSplit>(),
        onSome: (resolved) => Arr.of(resolved)
      })
    ))

const makeTrial = (trialNumber: number, value: number) =>
  new CompletedTrialForSplit({
    trialNumber,
    config: { trialNumber },
    value,
    sortStep: -1
  })

describe("tpe split trials fixture parity", () => {
  it.effect("replays split-trial fixture cases including pruned and liar-aware membership", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("split-trials.single-and-liar").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(SplitTrialsFixtureSchema)(loaded)

      yield* Effect.forEach(
        fixture.payload.cases,
        (fixtureCase) =>
          Effect.sync(() => {
            const trials = splitTrialsFromFixtureCase(fixtureCase.direction, fixtureCase.trials)
            const split = splitTrials(trials, () => fixtureCase.nBelow)

            expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(fixtureCase.expectedBelow)
            expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(fixtureCase.expectedAbove)
          }),
        { discard: true }
      )
    }))

  it.effect("uses trialNumber as the final tie key for split membership", () =>
    Effect.sync(() => {
      const trials = [
        makeTrial(5, 1),
        makeTrial(1, 1),
        makeTrial(4, 2),
        makeTrial(2, 2)
      ]

      const split = splitTrials(trials, () => 2)
      expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual([1, 5])
      expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual([2, 4])
    }))
})
