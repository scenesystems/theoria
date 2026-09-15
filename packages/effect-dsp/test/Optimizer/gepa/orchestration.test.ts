/**
 * GEPA orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Effect, Layer, Match, Option, Order, Schema, Stream, String as Str } from "effect"
import { GepaOrchestrationEventOrderFixtureSchema, loadFixture } from "../../helpers/dspy-fixtures/index.js"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const reflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nAnswer each question concisely using the most accurate fact available.\n```"
  })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.orElse(() => new AnswerResponse({ answer: "Paris" }))
  )

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
      const mock = yield* MockLanguageModel.make(MockLanguageModel.map(responseForPrompt))
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
          (tag) => Arr.findFirstIndex(tags, (candidate) => Str.Equivalence(candidate, tag))
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
