import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

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
  SamplerObjectiveUnsupported,
  SamplerSearchSpaceUnsupported,
  SearchErrorSchema,
  TrialError
} from "../../src/Errors/index.js"

const errorSamples = Arr.make(
  new InvalidSearchSpace({ reason: "invalid-space" }),
  new InvalidSamplerConfig({ reason: "invalid-sampler", sampler: "tpe" }),
  new SamplerExhausted({ sampler: "grid", nextTrialNumber: 2, available: 2 }),
  new InvalidStudyConfig({ reason: "invalid-study" }),
  new GridIncompatible({ dimension: "lr", reason: "non-finite" }),
  new SamplerSearchSpaceUnsupported({
    sampler: "gp-bo",
    reason: "requires continuous dimensions",
    dimension: "optimizer",
    distribution: "categorical"
  }),
  new SamplerObjectiveUnsupported({
    sampler: "cma-es",
    objective: "Multi",
    reason: "single objective only"
  }),
  new InvalidObjectiveValue({ trialNumber: 1, value: Number.NaN }),
  new InvalidObjectiveReport({ trialNumber: 1, reason: "duplicate-step", step: 0, value: 1, previousStep: 0 }),
  new TrialError({ trialNumber: 1, message: "objective failed", cause: "boom" }),
  new NoSuccessfulTrials({ trialCount: 4 }),
  new InvalidMathInput({ operation: "logDensity", reason: "sigma <= 0" }),
  new NotImplemented({ feature: "future-work" })
)

describe("Errors / taxonomy", () => {
  it.effect("decodes every error variant through the root SearchError schema", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(
        errorSamples,
        (sample) =>
          Effect.sync(() => {
            const decoded = Schema.decodeUnknownEither(SearchErrorSchema)(sample)

            expect(Either.isRight(decoded)).toBe(true)
          }),
        { discard: true }
      )
    }))

  it.effect("rejects non-error payloads at the root taxonomy boundary", () =>
    Effect.sync(() => {
      const decoded = Schema.decodeUnknownEither(SearchErrorSchema)({ _tag: "UnknownError", reason: "nope" })

      expect(Either.isLeft(decoded)).toBe(true)
    }))
})
