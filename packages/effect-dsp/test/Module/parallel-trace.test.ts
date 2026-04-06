/**
 * Module.parallel trace contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import * as Contracts from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.parallel trace surface", () => {
  it.effect("keeps branch ordering, usage accounting, and optimization projections stable in the shared trace surface", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const inner = yield* Module.predict("qa-parallel-trace-inner", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "A" },
          { answer: "B" },
          { answer: "C" }
        ])
      )
      const module = yield* Module.parallel({
        name: "qa-parallel-trace",
        module: inner,
        concurrency: 3
      })
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const execution = yield* Trace.withUsageTracking(
        Trace.withTracing(
          module.forward({
            inputs: [
              { question: "Alpha question" },
              { question: "Beta question" },
              { question: "Gamma question" }
            ]
          }).pipe(Effect.provide(lmLayer))
        )
      )
      const traces = execution[0][1]
      const usage = execution[1]
      const projections = yield* Effect.forEach(traces, Contracts.projectOptimizationObjective)

      expect(traces.map((entry) => entry.input.question)).toStrictEqual([
        "Alpha question",
        "Beta question",
        "Gamma question"
      ])
      expect(usage.callCount).toBe(3)
      expect(usage.cachedCount).toBe(0)
      expect(projections.map((projection) => projection.output.answer)).toStrictEqual(["A", "B", "C"])
    }))
})
