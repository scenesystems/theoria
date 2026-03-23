import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option, Schema } from "effect"

import type { Direction } from "../../../src/contracts/Direction.js"
import { PrunedIntermediateValue, prunedTrialScore } from "../../../src/internal/tpe/prunedScore.js"
import { CompletedTrialForSplit, splitTrials } from "../../../src/internal/tpe/splitTrials.js"
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
    Match.when("maximize", () => -value),
    Match.orElse(() => value)
  )

const normalizedIntermediateValues = (
  trial: SplitFixtureTrial
): Array<PrunedIntermediateValue> =>
  trial.intermediateValues.map(
    (entry) =>
      new PrunedIntermediateValue({
        step: entry.step,
        value: traceValueToNumber(entry.value)
      })
  )

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
  trials: ReadonlyArray<SplitFixtureTrial>
): Array<CompletedTrialForSplit> =>
  trials.flatMap((trial) =>
    splitTrialFromFixture(direction, trial).pipe(
      Option.match({
        onNone: () => [],
        onSome: (resolved) => [resolved]
      })
    )
  )

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

      fixture.payload.cases.forEach((fixtureCase) => {
        const trials = splitTrialsFromFixtureCase(fixtureCase.direction, fixtureCase.trials)
        const split = splitTrials(trials, () => fixtureCase.nBelow)

        expect(split.below.map((trial) => trial.trialNumber)).toEqual(fixtureCase.expectedBelow)
        expect(split.above.map((trial) => trial.trialNumber)).toEqual(fixtureCase.expectedAbove)
      })
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
      expect(split.below.map((trial) => trial.trialNumber)).toEqual([1, 5])
      expect(split.above.map((trial) => trial.trialNumber)).toEqual([2, 4])
    }))
})
