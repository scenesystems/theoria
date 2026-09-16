/**
 * BootstrapFewShot streaming event contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Either,
  Layer,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"

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
          Bool.match(Str.includes("France")(prompt), {
            onTrue: () => ({ answer: "Paris" }),
            onFalse: () => ({ answer: "London" })
          })
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        Optimizer.bootstrapFewShotStream({
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
          trainset: Arr.of(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
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

  it.effect("uses labeled fallback without starting a round when the round budget is zero", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "unused" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        Optimizer.bootstrapFewShotStream({
          module,
          trainset: Arr.of(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxRounds: 0,
          maxBootstrappedDemos: 2,
          threshold: 1
        })
      ).pipe(Effect.provide(lmLayer))

      const eventList = Arr.fromIterable(events)
      const calls = yield* Ref.get(mock.calls)
      const params = yield* Ref.get(module.params)
      const activationEvent = Arr.findFirst(
        eventList,
        Optimizer.BootstrapEvent.$is("BootstrapFallbackActivated")
      )

      expect(Arr.map(eventList, (event) => event._tag)).toEqual(Arr.make(
        "BootstrapFallbackActivated",
        "BootstrapFallbackCompleted",
        "BootstrapCompleted"
      ))
      expect(Option.map(activationEvent, (event) => event.averageScore)).toEqual(Option.some(0))
      expect(calls).toHaveLength(0)
      expect(params.demos).toHaveLength(1)
      expect(Option.map(Arr.head(params.demos), (demo) => demo.output)).toEqual(Option.some({ answer: "Paris" }))
    }))

  it.effect("fails without fallback or a terminal event when the round budget is zero", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "unused" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const eventRef = yield* Ref.make(Arr.empty<Optimizer.BootstrapEvent>())

      const result = yield* Optimizer.bootstrapFewShotWithEvents(
        {
          module,
          trainset: Arr.of(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "Paris" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxRounds: 0,
          maxBootstrappedDemos: 2,
          threshold: 1,
          fallbackToLabeledFewShot: false
        },
        (event) => Ref.update(eventRef, (events) => Arr.append(events, event))
      ).pipe(Effect.provide(lmLayer), Effect.either)

      const events = yield* Ref.get(eventRef)
      const calls = yield* Ref.get(mock.calls)

      expect(Either.isLeft(result)).toBe(true)
      expect(events).toEqual(Arr.empty())
      expect(calls).toHaveLength(0)
    }))
})
