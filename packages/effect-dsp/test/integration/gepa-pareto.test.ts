/**
 * GEPA integration contract.
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
import { Array as Arr, Boolean as Bool, Effect, Layer, Match, Option, Ref, Schema, Stream, String as Str } from "effect"
import { GepaSelectionWeightsFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const reflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nAnswer geography questions with concise, factually correct capital city names.\n```"
  })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => new AnswerResponse({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => new AnswerResponse({ answer: "Tokyo" })),
    Match.orElse(() => new AnswerResponse({ answer: "Lyon" }))
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

const answerText = (record: unknown): string =>
  Schema.decodeUnknownOption(AnswerResponse)(record).pipe(
    Option.map((response) => response.answer),
    Option.getOrElse(() => Str.empty)
  )

describe("GEPA integration", () => {
  it.effect(
    "runs end-to-end with deterministic mock LM and feedback-aware metric",
    () =>
      Effect.gen(function*() {
        const rawSelectionFixture = yield* loadFixture("dspy.gepa.selection.weights.seed-42")
        const selectionFixture = yield* Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema)(rawSelectionFixture)
        const signature = yield* makeQaSignature()
        const module = yield* Module.predict("qa", signature)
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.map(responseForPrompt)
        )
        const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
        const feedbackMetric = Metric.fromEffect("feedbackExactMatch", (prediction, expected) =>
          Effect.sync(() => {
            const predicted = answerText(prediction)
            const expectedAnswer = answerText(expected)
            const correct = Str.Equivalence(predicted, expectedAnswer)

            return Bool.match(correct, {
              onFalse: () =>
                new Metric.Result({
                  score: 0,
                  feedback: `expected ${expectedAnswer}, got ${predicted}`
                }),
              onTrue: () =>
                new Metric.Result({
                  score: 1,
                  feedback: "correct"
                })
            })
          }))

        const events = yield* Stream.runCollect(
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
            metric: feedbackMetric,
            maxIterations: 3,
            seed: selectionFixture.payload.seed
          })
        ).pipe(Effect.provide(layer))

        const eventList = Arr.fromIterable(events)
        const paretoEvents = Arr.filter(eventList, Optimizer.GEPAEvent.$is("ParetoUpdated"))
        const params = yield* Ref.get(module.params)

        expect(Arr.length(paretoEvents)).toBeGreaterThan(0)
        expect(Str.length(params.instructions)).toBeGreaterThan(0)
        expect(Option.isSome(Arr.findFirst(eventList, Optimizer.GEPAEvent.$is("AcceptanceEvaluated")))).toBe(true)
      })
  )
})
