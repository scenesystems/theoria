/**
 * Trace schema and projection determinism contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { decode, encode } from "@scenesystems/effect-dsp/Payload"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Equal, Option, Schema } from "effect"
import * as Response from "effect/ai/Response"

const Input = Schema.Struct({
  question: Schema.String,
  facts: Schema.Array(Schema.Struct({ count: Schema.FiniteFromString }))
})
const Output = Schema.Struct({ answer: Schema.String })

const usage = new Response.Usage({
  inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
})

const makeTraceEntry = Effect.gen(function*() {
  const input = yield* encode(Input, {
    question: "What is the capital of France?",
    facts: Arr.make({ count: 17 })
  })
  const output = yield* encode(Output, { answer: "Paris" })
  return new Trace.Entry({
    execution: yield* Schema.decodeEffect(Trace.Execution.Id)("qa-1"),
    moduleName: "qa",
    signatureDescription: "Answer questions with concise factual answers",
    input,
    output,
    prompt: "Question: What is the capital of France?",
    rawResponse: "Paris",
    usage,
    outcome: "completed",
    durationMs: 12,
    score: Trace.noScore,
    timestamp: 1_700_000_000_000
  })
})

describe("Trace projection", () => {
  it.effect("round-trips trace entries deterministically", () =>
    Effect.gen(function*() {
      const entry = yield* makeTraceEntry
      const codec = Schema.fromJsonString(Trace.Entry)
      const encoded = yield* Schema.encodeEffect(codec)(entry)
      const decoded = yield* Schema.decodeEffect(codec)(encoded)
      const reEncoded = yield* Schema.encodeEffect(codec)(decoded)

      expect(reEncoded).toEqual(encoded)
      expect(decoded.usage.inputTokens.total).toBe(17)
      expect(decoded.usage.outputTokens.total).toBe(12)
      expect(decoded.score).toEqual(Option.none())
      expect(yield* decode(Input, decoded.input)).toEqual({
        question: "What is the capital of France?",
        facts: Arr.make({ count: 17 })
      })
      expect(yield* decode(Schema.toEncoded(Input), decoded.input)).toEqual({
        question: "What is the capital of France?",
        facts: Arr.make({ count: "17" })
      })
      expect(yield* decode(Output, decoded.output)).toEqual({ answer: "Paris" })
    }))

  it.effect("retains native usage through optimization projection round trips", () =>
    Effect.gen(function*() {
      const entry = yield* makeTraceEntry
      const projection = yield* Trace.projectObjective(entry)
      const codec = Schema.fromJsonString(Trace.ObjectiveProjection)
      const encoded = yield* Schema.encodeEffect(codec)(projection)
      const decoded = yield* Schema.decodeEffect(codec)(encoded)
      const reEncoded = yield* Schema.encodeEffect(codec)(decoded)

      expect(reEncoded).toEqual(encoded)
      expect(Equal.equals(projection.usage, usage)).toBe(true)
    }))

  it.effect("round-trips absent usage separately from an observed zero-token report", () =>
    Effect.gen(function*() {
      const codec = Schema.fromJsonString(Trace.Call)
      const zero = new Response.Usage({ inputTokens: { total: 0 }, outputTokens: { total: 0 } })
      yield* Effect.forEach(Arr.make(Option.none<Response.Usage>(), Option.some(zero)), (observed) =>
        Effect.gen(function*() {
          const call = new Trace.Call({
            operation: "generateText",
            outcome: "interrupted",
            usage: observed,
            durationMs: 3,
            timestamp: 17
          })
          const encoded = yield* Schema.encodeEffect(codec)(call)
          const restored = yield* Schema.decodeEffect(codec)(encoded)

          expect(restored.usage).toEqual(observed)
          expect(restored.outcome).toBe("interrupted")
        }))
    }))
})
