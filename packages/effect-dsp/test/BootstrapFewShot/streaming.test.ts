/**
 * BootstrapFewShot streaming event contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Effect, Layer, Option, Ref, Schema, Stream } from "effect"

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

describe("BootstrapFewShot.stream", () => {
  it.effect("emits canonical BootstrapEvent progress over Stream", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initialParams = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParameters({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Bool.match(prompt.includes("France"), {
            onTrue: () => ({ answer: "Paris" }),
            onFalse: () => ({ answer: "London" })
          })
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        BootstrapFewShot.stream({
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

      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("RoundStarted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("TraceAccepted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("RoundCompleted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapCompleted")))).toBe(true)
      expect(Option.isNone(Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapFallbackActivated")))).toBe(
        true
      )
      expect(
        Option.match(firstEvent, {
          onNone: () => false,
          onSome: BootstrapFewShot.events.$is("RoundStarted")
        })
      ).toBe(true)
      expect(
        Option.match(lastEvent, {
          onNone: () => false,
          onSome: BootstrapFewShot.events.$is("BootstrapCompleted")
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
        new ModuleParameters({
          instructions: initialParams.instructions,
          demos: initialParams.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "London" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        BootstrapFewShot.stream({
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
      const completionEvent = Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapCompleted"))

      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapFallbackActivated")))).toBe(
        true
      )
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapFallbackCompleted")))).toBe(
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
