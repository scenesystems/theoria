/**
 * BootstrapFewShot streaming event contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Ref, Schema, Stream } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
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

describe("Optimizer.bootstrapFewShotStream", () => {
  it.effect("emits canonical BootstrapEvent progress over Stream", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
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
        MockLanguageModel.map((prompt) =>
          prompt.includes("France")
            ? { answer: "Paris" }
            : { answer: "London" }
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        Optimizer.bootstrapFewShotStream({
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
          maxRounds: 3,
          maxBootstrappedDemos: 1,
          threshold: 1
        })
      ).pipe(Effect.provide(lmLayer))

      const eventList = Arr.fromIterable(events)
      const firstEvent = Arr.head(eventList)
      const lastEvent = Arr.last(eventList)

      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("RoundStarted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("TraceAccepted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("RoundCompleted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("BootstrapCompleted")))).toBe(true)
      expect(Option.isNone(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("BootstrapFallbackActivated")))).toBe(
        true
      )
      expect(
        Option.match(firstEvent, {
          onNone: () => false,
          onSome: Optimizer.BootstrapEvent.$is("RoundStarted")
        })
      ).toBe(true)
      expect(
        Option.match(lastEvent, {
          onNone: () => false,
          onSome: Optimizer.BootstrapEvent.$is("BootstrapCompleted")
        })
      ).toBe(true)
    }))

  it.effect("emits fallback lifecycle events when trace acceptance stays at zero", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

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
        MockLanguageModel.fixed({ answer: "London" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        Optimizer.bootstrapFewShotStream({
          module,
          trainset: [
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ],
          metric: Metric.exactMatch("answer"),
          maxRounds: 1,
          maxBootstrappedDemos: 2,
          threshold: 1
        })
      ).pipe(Effect.provide(lmLayer))

      const eventList = Arr.fromIterable(events)
      const completionEvent = Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("BootstrapCompleted"))

      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("BootstrapFallbackActivated")))).toBe(
        true
      )
      expect(Option.isSome(Arr.findFirst(eventList, Optimizer.BootstrapEvent.$is("BootstrapFallbackCompleted")))).toBe(
        true
      )
      expect(Option.isSome(completionEvent)).toBe(true)
      expect(
        Option.match(completionEvent, {
          onNone: () => false,
          onSome: (event) => event.fallbackUsed
        })
      ).toBe(true)
    }))
})
