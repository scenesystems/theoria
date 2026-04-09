/**
 * Trace schema + projection determinism contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Trace from "effect-dsp/Trace"

const traceEntry = new Trace.Entry({
  moduleName: "qa",
  signatureDescription: "Answer questions with concise factual answers",
  input: { question: "What is the capital of France?" },
  output: { answer: "Paris" },
  prompt: "Question: What is the capital of France?",
  rawResponse: "Paris",
  inputTokens: Option.some(18),
  outputTokens: Option.some(2),
  durationMs: 12,
  score: Trace.noScore,
  timestamp: 1_700_000_000_000
})

describe("Trace projection", () => {
  it.effect("round-trips trace entries deterministically", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(Trace.Entry)(traceEntry)
      const decoded = yield* Schema.decode(Trace.Entry)(encoded)
      const reEncoded = yield* Schema.encode(Trace.Entry)(decoded)

      expect(reEncoded).toEqual(encoded)
    }))

  it.effect("round-trips optimization projections deterministically", () =>
    Effect.gen(function*() {
      const projection = yield* Contracts.OptimizationObjectiveSurface.fromTraceEntry(traceEntry)
      const encoded = yield* Schema.encode(Contracts.OptimizationObjectiveSurface)(projection)
      const decoded = yield* Schema.decode(Contracts.OptimizationObjectiveSurface)(encoded)
      const reEncoded = yield* Schema.encode(Contracts.OptimizationObjectiveSurface)(decoded)

      expect(reEncoded).toEqual(encoded)
      expect(projection.totalTokens).toBe(20)
      expect(projection.usage.cached).toBe(false)
    }))
})
