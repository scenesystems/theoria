import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

import * as Error from "../../src/SearchError.js"

const samples = Arr.make(
  new Error.InvalidSearchSpace({ reason: "invalid-space" }),
  new Error.InvalidSamplerConfig({ reason: "invalid-sampler", sampler: "tpe" }),
  new Error.SamplerExhausted({ sampler: "grid", nextTrialNumber: 2, available: 2 }),
  new Error.GridIncompatible({ dimension: "lr", reason: "non-finite" }),
  new Error.SamplerSearchSpaceUnsupported({ sampler: "gp-bo", reason: "continuous dimensions required" }),
  new Error.SamplerObjectiveUnsupported({ sampler: "cma-es", objective: "Multi", reason: "scalar only" }),
  new Error.InvalidStudyConfig({ reason: "invalid-study" }),
  new Error.InvalidObjectiveValue({ trialNumber: 1, value: Number.NaN }),
  new Error.InvalidObjectiveReport({ trialNumber: 1, reason: "duplicate-step", step: 0 }),
  new Error.TrialError({ trialNumber: 1, message: "objective failed", cause: "boom" }),
  new Error.NoSuccessfulTrials({ trialCount: 4 }),
  new Error.InvalidMathInput({ operation: "logDensity", reason: "sigma <= 0" }),
  new Error.NotImplemented({ feature: "future-work" }),
  new Error.ArtifactStorageError({ operation: "write", path: "/tmp/envelopes.jsonl", detail: "EACCES" })
)

describe("SearchError", () => {
  it.effect("decodes every expected failure", () =>
    Effect.forEach(
      samples,
      (sample) =>
        Effect.sync(() => expect(Either.isRight(Schema.decodeUnknownEither(Error.SearchError)(sample))).toBe(true)),
      { discard: true }
    ))

  it.effect("rejects failures outside the closed vocabulary", () =>
    Effect.sync(() => {
      const decoded = Schema.decodeUnknownEither(Error.SearchError)({ _tag: "UnknownError", reason: "nope" })
      expect(Either.isLeft(decoded)).toBe(true)
    }))
})
