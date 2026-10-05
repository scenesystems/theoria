/**
 * End-to-end predict → optimize → evaluate integration contract.
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Layer, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

const trainset = Arr.make(
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) })
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
      const initialParameters = yield* Ref.get(module.parameters)

      yield* Ref.set(
        module.parameters,
        new ModuleParameters({
          instructions: initialParameters.instructions,
          demos: initialParameters.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map(responseForPrompt)
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const baselineReport = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: trainset,
          metrics: {
            exactMatch: Metric.exactMatch("answer")
          },
          concurrency: 1
        })
      ).pipe(Effect.provide(layer))

      const compiled = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset,
          metric: Metric.exactMatch("answer"),
          maxRounds: 2,
          maxBootstrappedDemos: 2,
          metricThreshold: Option.some(1),
          maxLabeledDemos: 0
        })
      ).pipe(Effect.provide(layer))

      const optimizedReport = yield* Evaluate.run(
        new Evaluate.Options({
          module: compiled.program,
          examples: trainset,
          metrics: {
            exactMatch: Metric.exactMatch("answer")
          },
          concurrency: 1
        })
      ).pipe(Effect.provide(layer))

      const optimizedParameters = Option.getOrThrow(Record.get(compiled.parameters, module.name))
      const prediction = yield* compiled.program.forward({ question: "What is the capital of France?" }).pipe(
        Effect.provide(layer)
      )
      const calls = yield* Ref.get(mock.calls)

      expect(baselineReport.totalExamples).toBe(trainset.length)
      expect(baselineReport.failureCount).toBe(0)
      expect(optimizedParameters.demos.length).toBeGreaterThan(0)
      expect(optimizedReport.successCount).toBe(optimizedReport.totalExamples)
      expect(optimizedReport.failureCount).toBe(0)
      expect(optimizedReport.successCount).toBeGreaterThanOrEqual(baselineReport.successCount)
      expect(prediction).toEqual({ answer: "Paris" })
      expect(Arr.some(calls, (call) => call.prompt.includes("What is the capital of France?"))).toBe(true)
    }))
})
