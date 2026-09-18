/**
 * BootstrapRS optimizer contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { AllTrialsFailed } from "@scenesystems/effect-dsp/DspError"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Boolean as Bool, Effect, Either, Function as Fn, Layer, Match, Ref, Schema, String as Str } from "effect"

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
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
]

describe("BootstrapRS.run", () => {
  it.effect("selects the highest-scoring candidate on validation data", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initial = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: initial.instructions,
          demos: initial.demos,
          outputStrategy: "text"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Match.value(prompt).pipe(
            Match.when(Str.includes("What is the capital of France?"), () => "[[ ## answer ## ]]\nParis"),
            Match.when(Str.includes("What is the capital of Japan?"), () => "[[ ## answer ## ]]\nTokyo"),
            Match.when(Str.includes("Name the capital of Japan in one word"), (prompt) =>
              Bool.match(Str.includes("Tokyo")(prompt), {
                onTrue: () => "[[ ## answer ## ]]\nTokyo",
                onFalse: () => "[[ ## answer ## ]]\nLondon"
              })),
            Match.orElse(() =>
              "[[ ## answer ## ]]\nLondon"
            )
          )
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* BootstrapRS.run({
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
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.either(
        BootstrapRS.run({
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

      Either.match(result, {
        onLeft: (error) =>
          expect(error).toEqual(
            new AllTrialsFailed({
              message: "BootstrapRS failed to evaluate any candidate",
              trialCount: 0
            })
          ),
        onRight: Fn.constVoid
      })
    }))
})
