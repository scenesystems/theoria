/**
 * BootstrapRS optimizer contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Layer, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { assertNoMutation } from "../kit/Mutation.js"

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

const trainset = [
  new Example({
    input: { question: "What is the capital of France?" },
    labels: Option.some({ answer: "Paris" })
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    labels: Option.some({ answer: "Tokyo" })
  })
]

describe("BootstrapRS.run", () => {
  it.effect("selects the highest-scoring candidate on validation data", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initial = yield* Ref.get(module.parameters)

      yield* Ref.set(
        module.parameters,
        new ModuleParameters({
          instructions: initial.instructions,
          demos: initial.demos,
          outputStrategy: "text"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => {
          if (prompt.includes("What is the capital of France?")) {
            return "[[ ## answer ## ]]\nParis"
          }

          if (prompt.includes("What is the capital of Japan?")) {
            return "[[ ## answer ## ]]\nTokyo"
          }

          if (prompt.includes("Name the capital of Japan in one word")) {
            return prompt.includes("Tokyo")
              ? "[[ ## answer ## ]]\nTokyo"
              : "[[ ## answer ## ]]\nLondon"
          }

          return "[[ ## answer ## ]]\nLondon"
        })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* assertNoMutation(
        module,
        BootstrapRS.run(
          new BootstrapRS.Options({
            module,
            trainset,
            valset: [
              new Example({
                input: { question: "Name the capital of Japan in one word" },
                labels: Option.some({ answer: "Tokyo" })
              })
            ],
            metric: Metric.exactMatch("answer"),
            numCandidatePrograms: 2,
            maxRounds: 1,
            maxBootstrappedDemos: 1,
            metricThreshold: Option.some(1),
            maxLabeledDemos: 0
          })
        )
      ).pipe(Effect.provide(lmLayer))

      const parameters = Option.getOrThrow(Record.get(optimized.parameters, "qa"))

      expect(parameters.demos).toHaveLength(1)
      expect(parameters.demos[0]?.output).toEqual({ answer: "Tokyo" })
    }))

  it.effect("retains zero scores and the earliest candidate when every validation row fails", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* assertNoMutation(
        module,
        BootstrapRS.run(
          new BootstrapRS.Options({
            module,
            trainset,
            valset: [
              new Example({
                input: { question: 73 }
              })
            ],
            metric: Metric.exactMatch("answer"),
            numCandidatePrograms: 1,
            maxRounds: 1,
            maxBootstrappedDemos: 1,
            metricThreshold: Option.some(1),
            maxLabeledDemos: 0
          })
        ).pipe(Effect.provide(lmLayer))
      )

      expect(result.report.winnerSeed).toBe(-3)
      expect(Arr.map(result.report.candidates, (candidate) => candidate.score)).toEqual([0, 0, 0, 0])
      expect(Arr.map(result.report.candidates, (candidate) => candidate.evaluation.failureCount)).toEqual([1, 1, 1, 1])
    }))
})
