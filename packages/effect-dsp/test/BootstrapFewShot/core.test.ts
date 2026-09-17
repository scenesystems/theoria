/**
 * BootstrapFewShot core orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { BootstrapFailed } from "@scenesystems/effect-dsp/DspError"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean, Effect, Either, Layer, Number as Num, Ref, Schema, String as Str } from "effect"

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

describe("BootstrapFewShot.run", () => {
  it.effect("promotes accepted trace demos into module params with deterministic round prompt context", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(Str.includes("France")(prompt), {
            onTrue: () => ({ answer: "Paris" }),
            onFalse: () => ({ answer: "Tokyo" })
          })
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* BootstrapFewShot.run({
        module,
        trainset: Arr.make(
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          })
        ),
        metric: Metric.exactMatch("answer"),
        maxRounds: 5,
        maxBootstrappedDemos: 2,
        threshold: 1
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)

      expect(params.demos).toHaveLength(2)
      expect(Arr.map(params.demos, (demo) => demo.output)).toEqual(Arr.make({ answer: "Paris" }, { answer: "Tokyo" }))
      expect(calls).toHaveLength(2)
      expect(Arr.every(calls, (call) => Str.includes("[bootstrap-round:1]")(call.prompt))).toBe(true)
    }))

  it.effect("advances across rounds with unique prompt context markers for cache diversity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "text"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(Str.includes("What is the capital of Japan?")(prompt), {
            onTrue: () =>
              Boolean.match(Str.includes("[bootstrap-round:2]")(prompt), {
                onTrue: () => "[[ ## answer ## ]]\nTokyo",
                onFalse: () => "[[ ## answer ## ]]\nLondon"
              }),
            onFalse: () => "[[ ## answer ## ]]\nParis"
          })
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* BootstrapFewShot.run({
        module,
        trainset: Arr.make(
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          })
        ),
        metric: Metric.exactMatch("answer"),
        maxRounds: 4,
        maxBootstrappedDemos: 2,
        threshold: 1
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const japanCalls = Arr.filter(calls, (call) => Str.includes("What is the capital of Japan?")(call.prompt))

      expect(params.demos).toHaveLength(2)
      expect(calls).toHaveLength(4)
      expect(japanCalls).toHaveLength(2)
      expect(Arr.some(calls, (call) => Str.includes("[bootstrap-round:1]")(call.prompt))).toBe(true)
      expect(Arr.some(calls, (call) => Str.includes("[bootstrap-round:2]")(call.prompt))).toBe(true)
      expect(Arr.some(japanCalls, (call) => Str.includes("[bootstrap-round:1]")(call.prompt))).toBe(true)
      expect(Arr.some(japanCalls, (call) => Str.includes("[bootstrap-round:2]")(call.prompt))).toBe(true)
    }))

  it.effect("falls back to labeled demos when rounds produce zero accepted demos", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "London" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.either(
        BootstrapFewShot.run({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
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
      expect(Arr.map(params.demos, (demo) => demo.output)).toEqual(Arr.make({ answer: "Paris" }))
    }))

  it.effect("fails with BootstrapFailed when fallback is disabled", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "London" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* Effect.flip(
        BootstrapFewShot.run({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxRounds: 4,
          maxBootstrappedDemos: 2,
          threshold: 1,
          fallbackToLabeledFewShot: false
        }).pipe(Effect.provide(layer))
      )
      const calls = yield* Ref.get(mock.calls)

      expect(calls).toHaveLength(1)

      expect(result).toEqual(
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
    }))

  it.effect("rejects a NaN metric score even when the threshold is negative infinity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const nan = yield* Num.parse("NaN")
      const metric = Metric.make("nan-score", () => new Metric.Result({ score: nan }))

      const result = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
          metric,
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          threshold: yield* Num.parse("-Infinity"),
          fallbackToLabeledFewShot: false
        })
      ).pipe(Effect.provide(layer), Effect.either)
      const params = yield* Ref.get(module.params)

      expect(Either.isLeft(result)).toBe(true)
      expect(Arr.length(params.demos)).toBe(0)
      expect(
        Either.match(result, {
          onLeft: (error) => Str.Equivalence(error._tag, "BootstrapFailed"),
          onRight: () => false
        })
      ).toBe(true)
    }))

  it.effect("accepts positive infinity at a positive-infinity threshold", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const infinity = yield* Num.parse("Infinity")
      const metric = Metric.make("infinite-score", () => new Metric.Result({ score: infinity }))

      const optimized = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
          metric,
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          threshold: infinity,
          fallbackToLabeledFewShot: false
        })
      ).pipe(Effect.provide(layer))
      const params = yield* Ref.get(optimized.params)

      expect(Arr.length(params.demos)).toBe(1)
    }))
})
