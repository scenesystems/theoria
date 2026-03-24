import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import { ChatParseFallbackFixtureSchema, makeFixtureRegistry } from "../helpers/dspy-fixtures/index.js"

const fallbackEligibility = (options: {
  readonly errorType: string
  readonly useJsonAdapterFallback: boolean
  readonly isJsonAdapter: boolean
}): boolean =>
  options.useJsonAdapterFallback
  && !options.isJsonAdapter
  && options.errorType !== "ContextWindowExceededError"

describe("internal/chat-adapter fallback DSPy parity", () => {
  it.effect("matches fallback eligibility semantics across all contract cases", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.chat.parse-fallback.contract")
      const fixture = yield* Schema.decodeUnknown(ChatParseFallbackFixtureSchema)(rawFixture)

      yield* Effect.forEach(fixture.payload.cases, (caseItem) =>
        Effect.sync(() => {
          const computed = fallbackEligibility(caseItem)
          expect(computed).toBe(caseItem.fallbackEligible)
        }), { discard: true })

      expect(Arr.some(fixture.payload.cases, (caseItem) => caseItem.fallbackEligible)).toBe(true)
      expect(Arr.some(fixture.payload.cases, (caseItem) => !caseItem.fallbackEligible)).toBe(true)
    }))
})
