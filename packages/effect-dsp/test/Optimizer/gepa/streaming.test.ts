/**
 * GEPA streaming contracts.
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
import { Array as Arr, Effect, Layer, Match, Option, Schema, Stream, String as Str } from "effect"
import {
  GepaOrchestrationEventOrderFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const reflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nAnswer each question with a concise, factually accurate answer.\n```"
  })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => new AnswerResponse({ answer: "Paris" })),
    Match.orElse(() => new AnswerResponse({ answer: "Tokyo" }))
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

const runSeededStream = (moduleName: string, seed: number) =>
  Effect.gen(function*() {
    const signature = yield* makeQaSignature()
    const module = yield* Module.predict(moduleName, signature)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map(responseForPrompt)
    )
    const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

    return yield* Stream.runCollect(
      Optimizer.gepaStream({
        module,
        trainset: Arr.make(
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          }),
          new Example({
            input: { question: "What is the capital of Germany?" },
            output: { answer: "Berlin" }
          })
        ),
        metric: Metric.exactMatch("answer"),
        maxIterations: 3,
        seed
      })
    ).pipe(Effect.provide(layer))
  })

describe("Optimizer.gepaStream", () => {
  it.effect(
    "emits deterministic event order under fixed seed and fixtures",
    () =>
      Effect.gen(function*() {
        const rawSelectionFixture = yield* loadFixture("dspy.gepa.selection.weights.seed-42")
        const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
        const selectionFixture = yield* Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema)(rawSelectionFixture)
        const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
          rawEventOrderFixture
        )
        const firstRun = yield* runSeededStream("qa-seeded", selectionFixture.payload.seed)
        const secondRun = yield* runSeededStream("qa-seeded", selectionFixture.payload.seed)
        const firstEvents = Arr.fromIterable(firstRun)
        const secondEvents = Arr.fromIterable(secondRun)

        const tags = Arr.map(firstEvents, (event) => event._tag)

        expect(secondEvents).toEqual(firstEvents)
        expect(tags).toContain("ParetoUpdated")
        expect(Arr.last(tags)).toEqual(Option.some(eventOrderFixture.payload.expectedTerminalTag))
      })
  )
})
