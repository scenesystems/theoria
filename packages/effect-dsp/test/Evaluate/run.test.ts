/**
 * Evaluate.run contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Effect, Layer, Option, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

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

describe("Evaluate.run", () => {
  it.effect("evaluates labeled examples with deterministic aggregate scoring", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const report = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: [
            new Example({
              input: { question: "What is the capital of France?" },
              labels: Option.some({ answer: "Paris" })
            }),
            new Example({
              input: { question: "What is the capital of Japan?" },
              labels: Option.some({ answer: "Tokyo" })
            })
          ],
          metrics: {
            exact: Metric.exactMatch("answer")
          },
          concurrency: 2
        })
      ).pipe(
        Effect.provide(layer)
      )

      expect(report.totalExamples).toBe(2)
      expect(report.successCount).toBe(2)
      expect(report.failureCount).toBe(0)
      expect(report.outcomes).toHaveLength(2)
      expect(report.overallScores.exact).toBe(0.5)
    }))

  it.effect("records failed examples when inputs do not match the signature", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const report = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: [
            new Example({
              input: { question: "What is the capital of France?" },
              labels: Option.some({ answer: "Paris" })
            }),
            new Example({
              input: { question: 73 }
            })
          ],
          metrics: {
            exact: Metric.exactMatch("answer")
          }
        })
      ).pipe(
        Effect.provide(layer)
      )

      expect(report.successCount).toBe(1)
      expect(report.failureCount).toBe(1)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0]?.index).toBe(1)
      expect(report.failures[0]?.tag).toBe("EvaluationFailed")
      const failure = report.failures[0]

      if (failure) {
        const outcome = report.outcomes[1]
        expect(outcome?._tag).toBe("Failed")
        if (outcome?._tag === "Failed") expect(outcome.failure).toEqual(failure)
      }
    }))

  it.effect("keeps aggregate metric folding deterministic regardless of metric declaration order", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const examples = [
        new Example({
          input: { question: "What is the capital of France?" },
          labels: Option.some({ answer: "Paris" })
        }),
        new Example({
          input: { question: "What is the capital of Japan?" },
          labels: Option.some({ answer: "Tokyo" })
        })
      ]

      const reportA = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples,
          metrics: {
            exact: Metric.exactMatch("answer"),
            contains: Metric.contains("answer", "paris")
          }
        })
      ).pipe(Effect.provide(layer))

      const reportB = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples,
          metrics: {
            contains: Metric.contains("answer", "paris"),
            exact: Metric.exactMatch("answer")
          }
        })
      ).pipe(Effect.provide(layer))

      expect(reportA.overallScores).toEqual(reportB.overallScores)
      expect(reportA.outcomes).toEqual(reportB.outcomes)
      expect(reportA.failures).toEqual(reportB.failures)
    }))
})
