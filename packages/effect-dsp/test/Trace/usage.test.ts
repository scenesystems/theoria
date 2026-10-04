/**
 * Canonical provider-usage aggregation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Number, Option, Schema } from "effect"
import * as Response from "effect/ai/Response"

const completeUsage = new Response.Usage({
  inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
})

const call = (usage: Option.Option<Response.Usage>, outcome: Trace.Call["outcome"] = "success") =>
  new Trace.Call({
    operation: "generateObject",
    usage,
    outcome,
    durationMs: 4,
    timestamp: 1_700_000_000_000
  })

describe("Trace usage", () => {
  it.effect("preserves all five independently reported counters", () =>
    Effect.gen(function*() {
      const aggregate = Trace.accumulateUsage(Trace.emptyUsage, Option.some(completeUsage))

      expect(aggregate.tokens.inputTokens).toEqual(completeUsage.inputTokens)
      expect(aggregate.tokens.outputTokens).toEqual(completeUsage.outputTokens)
      expect(aggregate.callCount).toBe(1)
    }))

  it.effect("preserves omitted counters versus real zero through native JSON parsing", () =>
    Effect.gen(function*() {
      const codec = Schema.fromJsonString(Response.Usage)
      const omitted = yield* Schema.decodeEffect(codec)("{\"inputTokens\":{},\"outputTokens\":{}}")
      const zero = yield* Schema.decodeEffect(codec)(
        "{\"inputTokens\":{\"total\":0,\"uncached\":0,\"cacheRead\":0},\"outputTokens\":{\"total\":0,\"text\":0,\"reasoning\":0}}"
      )
      const omittedRoundTrip = yield* Schema.encodeEffect(codec)(omitted)
      const zeroRoundTrip = yield* Schema.encodeEffect(codec)(zero)
      const decodedOmitted = yield* Schema.decodeEffect(codec)(omittedRoundTrip)
      const decodedZero = yield* Schema.decodeEffect(codec)(zeroRoundTrip)

      expect(decodedOmitted.inputTokens.total).toBeUndefined()
      expect(decodedZero.inputTokens.total).toBe(0)
      expect(decodedZero.inputTokens.cacheRead).toBe(0)
    }))

  it.effect("propagates unknown counters without inferring totals or missing values", () =>
    Effect.gen(function*() {
      const partial = new Response.Usage({
        inputTokens: { total: 2 },
        outputTokens: { text: 0, reasoning: 1 }
      })
      const afterPartial = Trace.accumulateUsage(Trace.emptyUsage, Option.some(partial))
      const afterComplete = Trace.accumulateUsage(afterPartial, Option.some(completeUsage))
      const afterMissing = Trace.accumulateUsage(afterComplete, Option.none())

      expect(afterPartial.tokens.inputTokens.total).toBe(2)
      expect(afterPartial.tokens.outputTokens.text).toBe(0)
      expect(afterPartial.tokens.outputTokens.total).toBeUndefined()
      expect(afterPartial.tokens.inputTokens.cacheRead).toBeUndefined()
      expect(afterComplete.tokens.outputTokens.total).toBeUndefined()
      expect(afterComplete.tokens.inputTokens.cacheRead).toBeUndefined()
      expect(afterMissing.tokens.inputTokens.total).toBeUndefined()
      expect(afterMissing.tokens.outputTokens.reasoning).toBeUndefined()
      expect(afterMissing.callCount).toBe(3)
    }))

  it.effect("represents retries as multiple explicit calls", () =>
    Effect.gen(function*() {
      const first = new Response.Usage({
        inputTokens: { total: 10, uncached: 9, cacheRead: 1 },
        outputTokens: { total: 2, text: 2, reasoning: 0 }
      })
      const second = new Response.Usage({
        inputTokens: { total: 7, uncached: 5, cacheRead: 2 },
        outputTokens: { total: 10, text: 3, reasoning: 7 }
      })
      const tracked = yield* Trace.withUsageTracking(
        Effect.all(
          Arr.make(
            Trace.appendCall(call(Option.some(first), "failure")),
            Trace.appendCall(call(Option.some(second)))
          ),
          { discard: true }
        )
      )
      const usage = tracked[1]

      expect(usage.callCount).toBe(2)
      expect(usage.tokens.inputTokens).toEqual({ total: 17, uncached: 14, cacheRead: 3, cacheWrite: undefined })
      expect(usage.tokens.outputTokens).toEqual({ total: 12, text: 5, reasoning: 7 })
    }))

  it.effect("atomically aggregates concurrent child calls", () =>
    Effect.gen(function*() {
      const tracked = yield* Trace.withUsageTracking(
        Effect.forEach(
          Arr.make(completeUsage, completeUsage, completeUsage),
          (usage) => Trace.appendCall(call(Option.some(usage))),
          { concurrency: "unbounded", discard: true }
        )
      )
      const usage = tracked[1]

      expect(usage.callCount).toBe(3)
      expect(usage.tokens.inputTokens.total).toBe(Number.multiply(17, 3))
      expect(usage.tokens.outputTokens.total).toBe(Number.multiply(12, 3))
    }))
})
