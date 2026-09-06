/**
 * GEPA orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Effect, Layer, Option, Order, Schema, Stream } from "effect"
import { GepaOrchestrationEventOrderFixtureSchema, loadFixture } from "../../helpers/dspy-fixtures/index.js"

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

describe("Optimizer.gepa orchestration", () => {
  it.effect("runs merge-check → reflective mutation → acceptance → Pareto update in canonical order", () =>
    Effect.gen(function*() {
      const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
      const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
        rawEventOrderFixture
      )
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "Paris" }))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const events = yield* Stream.runCollect(
        Optimizer.gepaStream({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "London" }
            }),
            new Example({
              input: { question: "What is the capital of Japan?" },
              output: { answer: "Berlin" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxIterations: 2,
          seed: 42
        })
      ).pipe(Effect.provide(layer))

      const eventList = Arr.fromIterable(events)
      const tags = Arr.map(eventList, (event) => event._tag)
      // Where each stage of an iteration first appears; upstream's order is the fixture's.
      const firstAppearance = Option.all(
        Arr.map(
          eventOrderFixture.payload.expectedWithinIterationOrder,
          (tag) => Arr.findFirstIndex(tags, (candidate) => candidate === tag)
        )
      )

      expect(Option.isSome(firstAppearance)).toBe(true)
      expect(Option.map(firstAppearance, Arr.sort(Order.number))).toEqual(firstAppearance)
      expect(Arr.head(tags)).toEqual(
        Option.some(Arr.headNonEmpty(eventOrderFixture.payload.expectedWithinIterationOrder))
      )
      expect(Arr.last(tags)).toEqual(Option.some(eventOrderFixture.payload.expectedTerminalTag))
    }))
})
