/**
 * Canonical provider-usage aggregation contracts.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Equal, Number, Option, Schema, Tuple } from "effect"

const completeUsage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
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
      const aggregate = Contracts.accumulateUsage(Contracts.emptyUsage, Option.some(completeUsage))

      expect(Equal.equals(aggregate.tokens, completeUsage)).toBe(true)
      expect(aggregate.callCount).toBe(1)
    }))

  it.effect("preserves omitted counters versus real zero through native JSON parsing", () =>
    Effect.gen(function*() {
      const codec = Schema.parseJson(Response.Usage)
      const omitted = yield* Schema.decode(codec)("{}")
      const zero = yield* Schema.decode(codec)(
        "{\"inputTokens\":0,\"outputTokens\":0,\"totalTokens\":0,\"reasoningTokens\":0,\"cachedInputTokens\":0}"
      )
      const omittedRoundTrip = yield* Schema.encode(codec)(omitted)
      const zeroRoundTrip = yield* Schema.encode(codec)(zero)
      const decodedOmitted = yield* Schema.decode(codec)(omittedRoundTrip)
      const decodedZero = yield* Schema.decode(codec)(zeroRoundTrip)

      expect(Option.isNone(Option.fromNullable(decodedOmitted.inputTokens))).toBe(true)
      expect(Option.contains(Option.fromNullable(decodedZero.inputTokens), 0)).toBe(true)
      expect(Option.contains(Option.fromNullable(decodedZero.cachedInputTokens), 0)).toBe(true)
    }))

  it.effect("propagates unknown counters without inferring totals or missing values", () =>
    Effect.gen(function*() {
      const partial = new Response.Usage({
        inputTokens: 2,
        outputTokens: 0,
        totalTokens: undefined,
        reasoningTokens: 1
      })
      const afterPartial = Contracts.accumulateUsage(Contracts.emptyUsage, Option.some(partial))
      const afterComplete = Contracts.accumulateUsage(afterPartial, Option.some(completeUsage))
      const afterMissing = Contracts.accumulateUsage(afterComplete, Option.none())

      expect(afterPartial.tokens.inputTokens).toBe(2)
      expect(afterPartial.tokens.outputTokens).toBe(0)
      expect(Option.isNone(Option.fromNullable(afterPartial.tokens.totalTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(afterPartial.tokens.cachedInputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(afterComplete.tokens.totalTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(afterComplete.tokens.cachedInputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(afterMissing.tokens.inputTokens))).toBe(true)
      expect(Option.isNone(Option.fromNullable(afterMissing.tokens.reasoningTokens))).toBe(true)
      expect(afterMissing.callCount).toBe(3)
    }))

  it.effect("represents retries as multiple explicit calls", () =>
    Effect.gen(function*() {
      const first = new Response.Usage({
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
        reasoningTokens: 0,
        cachedInputTokens: 1
      })
      const second = new Response.Usage({
        inputTokens: 7,
        outputTokens: 3,
        totalTokens: 17,
        reasoningTokens: 7,
        cachedInputTokens: 2
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
      const usage = Tuple.getSecond(tracked)

      expect(usage.callCount).toBe(2)
      expect(usage.tokens.inputTokens).toBe(17)
      expect(usage.tokens.outputTokens).toBe(5)
      expect(usage.tokens.totalTokens).toBe(29)
      expect(usage.tokens.reasoningTokens).toBe(7)
      expect(usage.tokens.cachedInputTokens).toBe(3)
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
      const usage = Tuple.getSecond(tracked)

      expect(usage.callCount).toBe(3)
      expect(usage.tokens.inputTokens).toBe(Number.multiply(17, 3))
      expect(usage.tokens.totalTokens).toBe(Number.multiply(29, 3))
    }))
})
