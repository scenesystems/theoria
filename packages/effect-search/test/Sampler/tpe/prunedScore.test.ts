import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Match, Order, Schema } from "effect"

import type { PrunedTrialScore } from "../../../src/internal/tpe/prunedScore.js"
import {
  PrunedIntermediateValue,
  prunedTrialOrderKey,
  prunedTrialScore
} from "../../../src/internal/tpe/prunedScore.js"
import { FixtureRegistryLive, loadFixture, PrunedScoreFixture } from "../../helpers/fixtures/index.js"

type TraceValue = PrunedScoreFixture["payload"]["cases"][number]["intermediateValues"][number]["value"]

const traceValueToNumber = (value: TraceValue): number =>
  Match.value(value).pipe(
    Match.when("NaN", () => Number.NaN),
    Match.when("Infinity", () => Number.POSITIVE_INFINITY),
    Match.when("-Infinity", () => Number.NEGATIVE_INFINITY),
    Match.orElse((resolved) => resolved)
  )

const expectNumericValue = (actual: number, expected: number): void =>
  Match.value(Bool.not(Equal.equals(expected, expected))).pipe(
    Match.when(true, () => expect(actual).toBeNaN()),
    Match.orElse(() => expect(actual).toBe(expected))
  )

const prunedOrdering = Order.mapInput(
  Order.Tuple([Order.Number, Order.Number, Order.Number]),
  (entry: { readonly trialNumber: number; readonly score: PrunedTrialScore }) =>
    prunedTrialOrderKey(entry.trialNumber, entry.score)
)

describe("pruned-score fixture parity", () => {
  it.effect("replays pruned score traces and deterministic ordering", () =>
    Effect.gen(function*() {
      const loaded = yield* loadFixture("pruned-score.pruned-ordering").pipe(Effect.provide(FixtureRegistryLive))
      const fixture = yield* Schema.decodeUnknownEffect(PrunedScoreFixture)(loaded)

      const scored = Arr.map(fixture.payload.cases, (fixtureCase) => {
        const intermediateValues = Arr.map(
          fixtureCase.intermediateValues,
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

      const orderedTrialNumbers = Arr.map(Arr.sort(scored, prunedOrdering), (entry) => entry.trialNumber)

      expect(orderedTrialNumbers).toEqual(fixture.payload.expectedOrder)
    }))
})
