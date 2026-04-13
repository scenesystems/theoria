/**
 * Contract for contextual evaluation and optimizer scoring.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Ref } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Experimental from "effect-dsp/experimental"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const Execution = Experimental.OpenAgentTrace.Execution

describe("Evaluate/contextual", () => {
  it.effect("proves Evaluate.run and optimizer inner loops preserve contextual metric access without breaking legacy metrics", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-contextual", signature)
      const fixtureId = Execution.COUNTER_ITEMS_EXECUTION_FIXTURE_ID
      const example = new Example({
        input: { question: "What is the capital of France?" },
        output: { answer: "Paris" },
        metadata: Execution.CodingExecutionMetricMetadata.of(fixtureId)
      })
      const contextualMetric = Metric.fromEffectContextual("contextual", (context) =>
        Effect.succeed(
          new Metric.Result({
            score: context.input.question === "What is the capital of France?" &&
                context.prediction.answer === context.expected.answer &&
                context.metadata.fixtureId === fixtureId
              ? 1
              : 0
          })
        ))
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const report = yield* Evaluate.run({
        module,
        examples: [example],
        metrics: {
          contextual: contextualMetric,
          exact: Metric.exactMatch("answer")
        }
      }).pipe(Effect.provide(layer))
      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: [example],
        metric: contextualMetric,
        maxRounds: 1,
        maxBootstrappedDemos: 1,
        threshold: 1
      }).pipe(Effect.provide(layer))
      const params = yield* Ref.get(optimized.params)

      expect(report.overallScores.contextual).toBe(1)
      expect(report.overallScores.exact).toBe(1)
      expect(params.demos).toHaveLength(1)
      expect(params.demos[0]?.output).toEqual({ answer: "Paris" })
    }))
})
