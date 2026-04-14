/**
 * BootstrapRS optimizer contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Layer, Ref } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { AllTrialsFailed } from "effect-dsp/Errors"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const trainset = [
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
]

describe("Optimizer.bootstrapRS", () => {
  it.effect("selects the highest-scoring candidate on validation data", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const initial = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
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

      const optimized = yield* Optimizer.bootstrapRS({
        module,
        trainset,
        valset: [
          new Example({
            input: { question: "Name the capital of Japan in one word" },
            output: { answer: "Tokyo" }
          })
        ],
        metric: Metric.exactMatch("answer"),
        numCandidates: 2,
        seeds: [0, 1],
        maxRounds: 1,
        maxBootstrappedDemos: 1,
        threshold: 1,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provide(lmLayer))

      const params = yield* Ref.get(optimized.params)

      expect(params.demos).toHaveLength(1)
      expect(params.demos[0]?.output).toEqual({ answer: "Tokyo" })
    }))

  it.effect("fails with AllTrialsFailed when all candidate evaluations fail", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.either(
        Optimizer.bootstrapRS({
          module,
          trainset,
          valset: [
            new Example({
              input: { question: "This validation example has no label" }
            })
          ],
          metric: Metric.exactMatch("answer"),
          numCandidates: 1,
          seeds: [0],
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          threshold: 1,
          fallbackToLabeledFewShot: false
        }).pipe(Effect.provide(lmLayer))
      )

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left).toEqual(
          new AllTrialsFailed({
            message: "BootstrapRS failed to evaluate any candidate",
            trialCount: 0
          })
        )
      }
    }))
})
