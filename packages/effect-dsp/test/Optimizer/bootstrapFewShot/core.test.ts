/**
 * BootstrapFewShot core orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Layer, Ref, Schema } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { BootstrapFailed } from "effect-dsp/Errors"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

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

describe("Optimizer.bootstrapFewShot", () => {
  it.effect("promotes accepted trace demos into module params with deterministic round prompt context", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("France")
            ? { answer: "Paris" }
            : { answer: "Tokyo" }
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          })
        ],
        metric: Metric.exactMatch("answer"),
        maxRounds: 5,
        maxBootstrappedDemos: 2,
        threshold: 1
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)

      expect(params.demos).toHaveLength(2)
      expect(params.demos[0]?.output).toEqual({ answer: "Paris" })
      expect(params.demos[1]?.output).toEqual({ answer: "Tokyo" })
      expect(calls).toHaveLength(2)
      expect(Arr.every(calls, (call) => call.prompt.includes("[bootstrap-round:1]"))).toBe(true)
    }))

  it.effect("advances across rounds with unique prompt context markers for cache diversity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "text"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("What is the capital of Japan?")
            ? prompt.includes("[bootstrap-round:2]")
              ? "[[ ## answer ## ]]\nTokyo"
              : "[[ ## answer ## ]]\nLondon"
            : "[[ ## answer ## ]]\nParis"
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          })
        ],
        metric: Metric.exactMatch("answer"),
        maxRounds: 4,
        maxBootstrappedDemos: 2,
        threshold: 1
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const japanCalls = Arr.filter(calls, (call) => call.prompt.includes("What is the capital of Japan?"))

      expect(params.demos).toHaveLength(2)
      expect(calls).toHaveLength(4)
      expect(japanCalls).toHaveLength(2)
      expect(Arr.some(calls, (call) => call.prompt.includes("[bootstrap-round:1]"))).toBe(true)
      expect(Arr.some(calls, (call) => call.prompt.includes("[bootstrap-round:2]"))).toBe(true)
      expect(Arr.some(japanCalls, (call) => call.prompt.includes("[bootstrap-round:1]"))).toBe(true)
      expect(Arr.some(japanCalls, (call) => call.prompt.includes("[bootstrap-round:2]"))).toBe(true)
    }))

  it.effect("falls back to labeled demos when rounds produce zero accepted demos", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "London" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.either(
        Optimizer.bootstrapFewShot({
          module,
          trainset: [
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ],
          metric: Metric.exactMatch("answer"),
          maxRounds: 4,
          maxBootstrappedDemos: 2,
          threshold: 1
        }).pipe(Effect.provide(layer))
      )
      const calls = yield* Ref.get(mock.calls)
      const params = yield* Ref.get(module.params)

      expect(Either.isRight(result)).toBe(true)
      expect(calls).toHaveLength(1)
      expect(params.demos).toHaveLength(1)
      expect(params.demos[0]?.output).toEqual({ answer: "Paris" })
    }))

  it.effect("fails with BootstrapFailed when fallback is disabled", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "London" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.either(
        Optimizer.bootstrapFewShot({
          module,
          trainset: [
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ],
          metric: Metric.exactMatch("answer"),
          maxRounds: 4,
          maxBootstrappedDemos: 2,
          threshold: 1,
          fallbackToLabeledFewShot: false
        }).pipe(Effect.provide(layer))
      )
      const calls = yield* Ref.get(mock.calls)

      expect(Either.isLeft(result)).toBe(true)
      expect(calls).toHaveLength(1)

      if (Either.isLeft(result)) {
        expect(result.left).toEqual(
          new BootstrapFailed({
            message: "BootstrapFewShot produced zero accepted demos",
            roundsAttempted: 1,
            totalTraces: 1,
            threshold: 1,
            acceptedTraces: 0,
            rejectedTraces: 1,
            evaluatedExamples: 1,
            bestScoreSeen: true,
            bestScore: 0,
            averageScore: 0
          })
        )
      }
    }))
})
