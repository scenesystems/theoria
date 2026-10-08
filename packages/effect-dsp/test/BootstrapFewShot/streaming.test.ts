/**
 * BootstrapFewShot streaming event contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Effect, Layer, Option, Ref, Schema, Stream, String as Str } from "effect"
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

describe("BootstrapFewShot.stream", () => {
  it.effect("emits canonical BootstrapEvent progress over Stream", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const initialParameters = yield* Ref.get(module.parameters)

      yield* Ref.set(
        module.parameters,
        new ModuleParameters({
          instructions: initialParameters.instructions,
          demos: initialParameters.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Bool.match(Str.includes("France")(prompt), {
            onFalse: () => ({ answer: "London" }),
            onTrue: () => ({ answer: "Paris" })
          })
        )
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        BootstrapFewShot.stream(
          new BootstrapFewShot.Options({
            module,
            trainset: [
              new Example({
                input: { question: "What is the capital of France?" },
                labels: Option.some({ answer: "Paris" })
              }),
              new Example({
                input: { question: "What is the capital of Japan?" },
                labels: Option.some({ answer: "Tokyo" })
              })
            ],
            metric: Metric.exactMatch("answer"),
            maxRounds: 3,
            maxBootstrappedDemos: 1,
            metricThreshold: Option.some(1),
            maxLabeledDemos: 0
          })
        )
      ).pipe(Effect.provide(lmLayer))

      const eventList = Arr.fromIterable(events)
      const firstEvent = Arr.head(eventList)
      const lastEvent = Arr.last(eventList)

      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("RoundStarted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("TraceAccepted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("RoundCompleted")))).toBe(true)
      expect(Option.isSome(Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapCompleted")))).toBe(true)
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

  it.effect("reports labeled completion when trace acceptance stays at zero", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const initialParameters = yield* Ref.get(module.parameters)

      yield* Ref.set(
        module.parameters,
        new ModuleParameters({
          instructions: initialParameters.instructions,
          demos: initialParameters.demos,
          outputStrategy: "structured"
        })
      )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "London" })
      )
      const lmLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        BootstrapFewShot.stream(
          new BootstrapFewShot.Options({
            module,
            trainset: [
              new Example({
                input: { question: "What is the capital of France?" },
                labels: Option.some({ answer: "Paris" })
              })
            ],
            metric: Metric.exactMatch("answer"),
            maxRounds: 1,
            maxBootstrappedDemos: 2,
            metricThreshold: Option.some(1)
          })
        )
      ).pipe(Effect.provide(lmLayer))

      const eventList = Arr.fromIterable(events)
      const completionEvent = Arr.findFirst(eventList, BootstrapFewShot.events.$is("BootstrapCompleted"))

      expect(Option.isSome(completionEvent)).toBe(true)
      expect(Option.getOrThrow(completionEvent).labeledCount).toBe(1)
    }))
})
