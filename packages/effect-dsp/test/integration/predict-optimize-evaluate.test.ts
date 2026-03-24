/**
 * End-to-end predict → optimize → evaluate integration contract.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

const trainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const responseForPrompt = (prompt: string) =>
  prompt.includes("What is the capital of France?")
    ? { answer: "Paris" }
    : prompt.includes("What is the capital of Japan?")
    ? { answer: "Tokyo" }
    : { answer: "Unknown" }

describe("integration/predict-optimize-evaluate", () => {
  it.effect("runs the full pipeline with deterministic mock-layer behavior", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make(
        "Answer geography questions with concise city names",
        {
          question: Signature.describe(Schema.String, "Question to answer")
        },
        {
          answer: Signature.describe(Schema.String, "Short factual answer")
        }
      )
      const module = yield* Module.predict("qa-e2e", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map(responseForPrompt)
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const baselineReport = yield* Evaluate.run({
        module,
        examples: trainset,
        metrics: {
          exactMatch: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(Effect.provide(layer))

      yield* Optimizer.bootstrapFewShot({
        module,
        trainset,
        metric: Metric.exactMatch("answer"),
        maxRounds: 2,
        maxBootstrappedDemos: 2,
        threshold: 1,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provide(layer))

      const optimizedReport = yield* Evaluate.run({
        module,
        examples: trainset,
        metrics: {
          exactMatch: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(Effect.provide(layer))

      const optimizedParams = yield* Ref.get(module.params)
      const prediction = yield* module.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(layer)
      )
      const calls = yield* Ref.get(mock.calls)

      expect(baselineReport.totalExamples).toBe(trainset.length)
      expect(baselineReport.failureCount).toBe(0)
      expect(optimizedParams.demos.length).toBeGreaterThan(0)
      expect(optimizedReport.successCount).toBe(optimizedReport.totalExamples)
      expect(optimizedReport.failureCount).toBe(0)
      expect(optimizedReport.successCount).toBeGreaterThanOrEqual(baselineReport.successCount)
      expect(prediction).toEqual({ answer: "Paris" })
      expect(Arr.some(calls, (call) => call.prompt.includes("What is the capital of France?"))).toBe(true)
    }))
})
