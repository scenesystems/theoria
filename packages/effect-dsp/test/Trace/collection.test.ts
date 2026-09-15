/**
 * Trace entry and call collection contracts.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Option, Schema, Tuple } from "effect"
import { encodePayload } from "../../src/contracts/Payload.js"

const Input = Schema.Struct({ question: Schema.String })
const Output = Schema.Struct({ answer: Schema.String })

const usage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
})

const entry = (moduleName: string) =>
  Effect.gen(function*() {
    const input = yield* encodePayload(Input, { question: "Capital?" })
    const output = yield* encodePayload(Output, { answer: "Paris" })
    return new Trace.Entry({
      moduleName,
      signatureDescription: "Answer questions",
      input,
      output,
      prompt: "Capital?",
      rawResponse: "Paris",
      usage,
      durationMs: 12,
      score: Trace.noScore,
      timestamp: 1_700_000_000_000
    })
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
      yield* entry("outside").pipe(Effect.flatMap(Trace.append))
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
        entry("qa").pipe(Effect.flatMap(Trace.append), Effect.as("trace-result"))
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
