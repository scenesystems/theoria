import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Record, Schema } from "effect"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

import { makeFixtureRegistry, MultiChainComparisonFixtureSchema } from "../helpers/dspy-fixtures/index.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with short factual answers",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.multiChainComparison DSPy parity", () => {
  it.effect("matches the committed DSPy comparison fixture for candidate summaries and final answer", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const rawFixture = yield* registry.load("dspy.multiChainComparison.basic")
      const fixture = yield* Schema.decodeUnknown(MultiChainComparisonFixtureSchema)(rawFixture)

      const qa = yield* makeQaSignature()
      const module = yield* Module.multiChainComparison({
        name: "qa-multi-chain-dspy-parity",
        signature: qa,
        candidateCount: fixture.payload.candidateCount,
        concurrency: fixture.payload.candidateCount,
        seed: 0
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          ...fixture.payload.candidateResponses,
          fixture.payload.compareResponse
        ])
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const traced = yield* Trace.withTracing(
        module.forward(fixture.payload.sampleInput).pipe(
          Effect.provide(lmLayer)
        )
      )
      const result = traced[0]
      const entries = traced[1]
      const compareEntry = entries[fixture.payload.candidateCount]

      expect(fixture.payload.dspyPredictionKeys).toContain("rationale")
      expect(fixture.payload.dspyPredictionKeys).toContain("answer")
      expect(result).toStrictEqual({ answer: fixture.payload.compareResponse.answer })
      expect(entries).toHaveLength(fixture.payload.traceEntries.length)
      expect(Record.keys(compareEntry?.input ?? {})).toContain("candidate_comparisons")
      expect(compareEntry?.input.candidate_comparisons).toBe(fixture.payload.candidateComparisons)
      expect(Record.keys(compareEntry?.output ?? {})).toStrictEqual(["reasoning", "answer"])
    }))
})
