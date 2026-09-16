/**
 * Trace entry and call collection contracts.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Option, Tuple } from "effect"

const usage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
})

const entry = (moduleName: string) =>
  new Trace.Entry({
    moduleName,
    signatureDescription: "Answer questions",
    input: { question: "Capital?" },
    output: { answer: "Paris" },
    prompt: "Capital?",
    rawResponse: "Paris",
    usage,
    durationMs: 12,
    score: Trace.noScore,
    timestamp: 1_700_000_000_000
  })

const call = new Trace.Call({
  operation: "generateText",
  usage: Option.some(usage),
  outcome: "success",
  durationMs: 12,
  timestamp: 1_700_000_000_000
})

describe("Trace collection", () => {
  it.effect("is a no-op outside lexical scopes", () =>
    Effect.gen(function*() {
      yield* Trace.append(entry("outside"))
      yield* Trace.appendCall(call)

      const entries = yield* Trace.get
      const calls = yield* Trace.getCalls
      const aggregate = yield* Trace.getUsage

      expect(entries).toEqual(Arr.empty())
      expect(calls).toEqual(Arr.empty())
      expect(aggregate.callCount).toBe(0)
      expect(aggregate.tokens.inputTokens).toBe(0)
    }))

  it.effect("collects entries and calls in their independent scopes", () =>
    Effect.gen(function*() {
      const traced = yield* Trace.withTracing(
        Trace.append(entry("qa")).pipe(Effect.as("trace-result"))
      )
      const called = yield* Trace.withCalls(
        Trace.appendCall(call).pipe(Effect.as("call-result"))
      )
      const tracedEntry = yield* Arr.head(Tuple.getSecond(traced))
      const observedCall = yield* Arr.head(Tuple.getSecond(called))

      expect(Tuple.getFirst(traced)).toBe("trace-result")
      expect(tracedEntry.moduleName).toBe("qa")
      expect(Tuple.getFirst(called)).toBe("call-result")
      expect(observedCall.operation).toBe("generateText")
    }))

  it.effect("makes completed inner events visible once to their parent", () =>
    Effect.gen(function*() {
      const nested = yield* Trace.withCalls(
        Trace.withCalls(Trace.appendCall(call))
      )
      const inner = Tuple.getSecond(Tuple.getFirst(nested))
      const outer = Tuple.getSecond(nested)

      expect(Arr.length(inner)).toBe(1)
      expect(Arr.length(outer)).toBe(1)
    }))
})
