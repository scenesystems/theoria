/**
 * Trace schema and projection determinism contracts.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Contracts from "@scenesystems/effect-dsp/contracts"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Equal, Option, Schema } from "effect"

const usage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
})

const makeTraceEntry = () =>
  new Trace.Entry({
    moduleName: "qa",
    signatureDescription: "Answer questions with concise factual answers",
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" },
    prompt: "Question: What is the capital of France?",
    rawResponse: "Paris",
    usage,
    durationMs: 12,
    score: Trace.noScore,
    timestamp: 1_700_000_000_000
  })

describe("Trace projection", () => {
  it.effect("round-trips trace entries deterministically", () =>
    Effect.gen(function*() {
      const entry = makeTraceEntry()
      const codec = Schema.parseJson(Trace.Entry)
      const encoded = yield* Schema.encode(codec)(entry)
      const decoded = yield* Schema.decode(codec)(encoded)
      const reEncoded = yield* Schema.encode(codec)(decoded)

      expect(reEncoded).toEqual(encoded)
      expect(decoded.usage.totalTokens).toBe(29)
      expect(decoded.score).toEqual(Option.none())
    }))

  it.effect("retains native usage through optimization projection round trips", () =>
    Effect.gen(function*() {
      const entry = makeTraceEntry()
      const projection = yield* Contracts.projectOptimizationObjective(entry)
      const codec = Schema.parseJson(Contracts.OptimizationObjectiveSurface)
      const encoded = yield* Schema.encode(codec)(projection)
      const decoded = yield* Schema.decode(codec)(encoded)
      const reEncoded = yield* Schema.encode(codec)(decoded)

      expect(reEncoded).toEqual(encoded)
      expect(Equal.equals(projection.usage, usage)).toBe(true)
    }))

  it.effect("round-trips absent usage separately from an observed zero-token report", () =>
    Effect.gen(function*() {
      const codec = Schema.parseJson(Trace.Call)
      const zero = new Response.Usage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
      yield* Effect.forEach(Arr.make(Option.none<Response.Usage>(), Option.some(zero)), (observed) =>
        Effect.gen(function*() {
          const call = new Trace.Call({
            operation: "generateText",
            outcome: "interrupted",
            usage: observed,
            durationMs: 3,
            timestamp: 17
          })
          const encoded = yield* Schema.encode(codec)(call)
          const restored = yield* Schema.decode(codec)(encoded)

          expect(restored.usage).toEqual(observed)
          expect(restored.outcome).toBe("interrupted")
        }))
    }))
})
