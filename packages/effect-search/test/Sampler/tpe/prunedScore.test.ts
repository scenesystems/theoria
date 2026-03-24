import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Order, Schema } from "effect"

import type { PrunedTrialScore } from "../../../src/internal/tpe/prunedScore.js"
import {
  PrunedIntermediateValue,
  prunedTrialOrderKey,
  prunedTrialScore
} from "../../../src/internal/tpe/prunedScore.js"
import {
  FixtureRegistryLive,
  loadFixture,
  type PrunedScoreFixture,
  PrunedScoreFixtureSchema
} from "../../helpers/fixtures.js"

type TraceValue = PrunedScoreFixture["payload"]["cases"][number]["intermediateValues"][number]["value"]
type ExpectedScore = PrunedScoreFixture["payload"]["cases"][number]["expectedScore"]

const traceValueToNumber = (value: TraceValue | ExpectedScore): number =>
  Match.value(value).pipe(
    Match.when("NaN", () => Number.NaN),
    Match.when("Infinity", () => Number.POSITIVE_INFINITY),
    Match.when("-Infinity", () => Number.NEGATIVE_INFINITY),
    Match.orElse((resolved) => resolved)
  )

const expectNumericValue = (actual: number, expected: number): void =>
  Match.value(Number.isNaN(expected)).pipe(
    Match.when(true, () => expect(actual).toBeNaN()),
    Match.orElse(() => expect(actual).toBe(expected))
  )

const prunedOrdering = Order.mapInput(
  Order.tuple(Order.number, Order.number, Order.number),
  (entry: { readonly trialNumber: number; readonly score: PrunedTrialScore }) =>
    prunedTrialOrderKey(entry.trialNumber, entry.score)
)

describe("pruned-score fixture parity", () => {
  it.effect("replays pruned score traces and deterministic ordering", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruned-score.pruned-ordering").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknown(PrunedScoreFixtureSchema)(loaded)

      const scored = fixture.payload.cases.map((fixtureCase) => {
        const intermediateValues = fixtureCase.intermediateValues.map(
          (entry) =>
            new PrunedIntermediateValue({
              step: entry.step,
              value: traceValueToNumber(entry.value)
            })
        )
        const score = prunedTrialScore(intermediateValues, fixture.payload.direction)
        const expectedScore = traceValueToNumber(fixtureCase.expectedScore)

        expect(score.step).toBe(fixtureCase.expectedStep)
        expectNumericValue(score.value, expectedScore)

        return {
          trialNumber: fixtureCase.trialNumber,
          score
        }
      })

      const orderedTrialNumbers = Arr.sort(scored, prunedOrdering).map((entry) => entry.trialNumber)

      expect(orderedTrialNumbers).toEqual(fixture.payload.expectedOrder)
    }))
})
