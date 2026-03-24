import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Predicate, Schema } from "effect"

import {
  InvalidMathInput,
  InvalidSamplerConfig,
  InvalidSearchSpace,
  InvalidStudyConfig,
  isSearchError,
  SamplerErrorSchema,
  SearchErrorSchema,
  SearchErrorTypeId,
  SpaceErrorSchema,
  StudyErrorSchema,
  TrialError
} from "../../src/Errors/index.js"

describe("Errors / union", () => {
  it.effect("marks every search error instance with SearchErrorTypeId and guard", () =>
    Effect.sync(() => {
      const sample = new TrialError({ trialNumber: 11, message: "boom", cause: "boom" })

      expect(Predicate.hasProperty(sample, SearchErrorTypeId)).toBe(true)
      expect(isSearchError(sample)).toBe(true)
    }))

  it.effect("decodes all module unions and root union", () =>
    Effect.sync(() => {
      const rootDecoded = Schema.decodeUnknownEither(SearchErrorSchema)(
        new TrialError({ trialNumber: 1, message: "objective failed", cause: "x" })
      )
      const samplerDecoded = Schema.decodeUnknownEither(SamplerErrorSchema)(
        new InvalidSamplerConfig({ reason: "bad sampler" })
      )
      const studyDecoded = Schema.decodeUnknownEither(StudyErrorSchema)(
        new InvalidStudyConfig({ reason: "bad study" })
      )
      const spaceDecoded = Schema.decodeUnknownEither(SpaceErrorSchema)(
        new InvalidSearchSpace({ reason: "bad space" })
      )

      expect(Either.isRight(rootDecoded)).toBe(true)
      expect(Either.isRight(samplerDecoded)).toBe(true)
      expect(Either.isRight(studyDecoded)).toBe(true)
      expect(Either.isRight(spaceDecoded)).toBe(true)
    }))

  it.effect("rejects plain values with isSearchError before schema decode", () =>
    Effect.sync(() => {
      const nonSearch = new InvalidMathInput({ operation: "test", reason: "bad" })
      const plainPayload = { _tag: "effect-search/InvalidMathInput", operation: "test", reason: "bad" }
      const decoded = Schema.decodeUnknownEither(SearchErrorSchema)(plainPayload)

      expect(isSearchError(nonSearch)).toBe(true)
      expect(isSearchError(plainPayload)).toBe(false)
      expect(Either.isRight(decoded)).toBe(true)

      if (Either.isRight(decoded)) {
        expect(isSearchError(decoded.right)).toBe(true)
      }
    }))
})
