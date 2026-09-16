import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import { isSearchError, SearchError, TrialError } from "../../src/SearchError.js"

describe("SearchError guard", () => {
  it.effect("recognizes constructed and schema-decoded failures", () =>
    Effect.sync(() => {
      const instance = new TrialError({ trialNumber: 11, message: "boom", cause: "cause" })
      const wire = {
        _tag: "effect-search/TrialError",
        trialNumber: 11,
        message: "boom",
        cause: "cause"
      }
      const decoded = Schema.decodeUnknownEither(SearchError)(wire)

      expect(isSearchError(instance)).toBe(true)
      expect(Either.isRight(decoded)).toBe(true)
      if (Either.isRight(decoded)) {
        expect(isSearchError(decoded.right)).toBe(true)
      }
    }))

  it.effect("rejects a recognized tag with invalid fields", () =>
    Effect.sync(() => {
      expect(isSearchError({
        _tag: "effect-search/TrialError",
        trialNumber: "eleven",
        message: "boom",
        cause: "cause"
      })).toBe(false)
    }))
})
