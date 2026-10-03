import { describe, expect, it } from "@effect/vitest"
import * as Journal from "@scenesystems/effect-study/Journal"
import { Effect, Result, Schema } from "effect"

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
      const decoded = Schema.decodeUnknownResult(SearchError)(wire)

      expect(isSearchError(instance)).toBe(true)
      expect(Result.isSuccess(decoded)).toBe(true)
      expect(Result.isSuccess(decoded) && isSearchError(decoded.success)).toBe(true)
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

  it.effect("recognizes the shared persistence failure", () =>
    Effect.sync(() => {
      const failure = new Journal.Failure({ operation: "read", path: "records.jsonl", line: 2, detail: "torn" })

      expect(isSearchError(failure)).toBe(true)
      expect(Schema.is(SearchError)(failure)).toBe(true)
    }))
})
