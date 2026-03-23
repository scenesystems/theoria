import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Tuple } from "effect"

import {
  GridIncompatible,
  InvalidMathInput,
  InvalidObjectiveReport,
  InvalidObjectiveValue,
  InvalidSamplerConfig,
  InvalidSearchSpace,
  InvalidStudyConfig,
  NoSuccessfulTrials,
  NotImplemented,
  SamplerExhausted,
  TrialError
} from "../../src/Errors/index.js"

const cases = Arr.make(
  Tuple.make(new InvalidSearchSpace({ reason: "x" }), "effect-search/InvalidSearchSpace"),
  Tuple.make(new InvalidSamplerConfig({ reason: "x" }), "effect-search/InvalidSamplerConfig"),
  Tuple.make(
    new SamplerExhausted({ sampler: "grid", nextTrialNumber: 1, available: 1 }),
    "effect-search/SamplerExhausted"
  ),
  Tuple.make(new InvalidStudyConfig({ reason: "x" }), "effect-search/InvalidStudyConfig"),
  Tuple.make(new GridIncompatible({ dimension: "x", reason: "x" }), "effect-search/GridIncompatible"),
  Tuple.make(new InvalidObjectiveValue({ trialNumber: 1, value: Number.NaN }), "effect-search/InvalidObjectiveValue"),
  Tuple.make(new InvalidObjectiveReport({ trialNumber: 1, reason: "x" }), "effect-search/InvalidObjectiveReport"),
  Tuple.make(new NoSuccessfulTrials({ trialCount: 1 }), "effect-search/NoSuccessfulTrials"),
  Tuple.make(new InvalidMathInput({ operation: "x", reason: "x" }), "effect-search/InvalidMathInput"),
  Tuple.make(new NotImplemented({ feature: "x" }), "effect-search/NotImplemented"),
  Tuple.make(new TrialError({ trialNumber: 1, message: "x", cause: "x" }), "effect-search/TrialError")
)

describe("Errors / qualified tags", () => {
  it.effect("uses qualified effect-search/* identifiers for every error tag", () =>
    Effect.forEach(
      cases,
      ([error, expectedTag]) =>
        Effect.sync(() => {
          expect(error._tag).toBe(expectedTag)
        }),
      { discard: true }
    ))
})
