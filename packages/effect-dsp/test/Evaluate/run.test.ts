/**
 * Evaluate.run contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Evaluate.run", () => {
  it.effect("evaluates labeled examples with deterministic aggregate scoring", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const report = yield* Evaluate.run({
        module,
        examples: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          })
        ],
        metrics: {
          exact: Metric.exactMatch("answer")
        },
        concurrency: 2
      }).pipe(
        Effect.provide(layer)
      )

      expect(report.totalExamples).toBe(2)
      expect(report.successCount).toBe(2)
      expect(report.failureCount).toBe(0)
      expect(report.results).toHaveLength(2)
      expect(report.overallScores.exact).toBe(0.5)
    }))

  it.effect("records failed examples when expected output is missing", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const report = yield* Evaluate.run({
        module,
        examples: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" }
          })
        ],
        metrics: {
          exact: Metric.exactMatch("answer")
        }
      }).pipe(
        Effect.provide(layer)
      )

      expect(report.successCount).toBe(1)
      expect(report.failureCount).toBe(1)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0]?.index).toBe(1)
      expect(report.failures[0]?.tag).toBe("EvaluationFailed")
      const failure = report.failures[0]

      if (failure) {
        expect(report.results[1]?.failure).toEqual(Option.some(failure))
      }
    }))

  it.effect("keeps aggregate metric folding deterministic regardless of metric declaration order", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const examples = [
        new Example({
          input: { question: "What is the capital of France?" },
          output: { answer: "Paris" }
        }),
        new Example({
          input: { question: "What is the capital of Japan?" },
          output: { answer: "Tokyo" }
        })
      ]

      const reportA = yield* Evaluate.run({
        module,
        examples,
        metrics: {
          exact: Metric.exactMatch("answer"),
          contains: Metric.contains("answer", "paris")
        }
      }).pipe(Effect.provide(layer))

      const reportB = yield* Evaluate.run({
        module,
        examples,
        metrics: {
          contains: Metric.contains("answer", "paris"),
          exact: Metric.exactMatch("answer")
        }
      }).pipe(Effect.provide(layer))

      expect(reportA.overallScores).toEqual(reportB.overallScores)
      expect(reportA.results).toEqual(reportB.results)
      expect(reportA.failures).toEqual(reportB.failures)
    }))
})
