/**
 * GEPA integration contract.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Predicate, Ref, Schema, Stream } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import {
  GepaOrchestrationEventOrderFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  loadFixture
} from "../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const answerText = (record: Readonly<Record<string, unknown>>): string =>
  Option.getOrElse(
    Option.fromNullable(record.answer).pipe(
      Option.filter(Predicate.isString)
    ),
    () => ""
  )

describe("GEPA integration", () => {
  it.effect(
    "runs end-to-end with deterministic mock LM and feedback-aware metric",
    () =>
      Effect.gen(function*() {
        const rawSelectionFixture = yield* loadFixture("dspy.gepa.selection.weights.seed-42")
        const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
        const selectionFixture = yield* Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema)(rawSelectionFixture)
        const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
          rawEventOrderFixture
        )
        const signature = yield* conciseFactsQaSignature
        const module = yield* Module.predict("qa", signature)
        const mock = yield* MockLanguageModel.make(
          MockLanguageModel.map((prompt) =>
            prompt.includes("France")
              ? { answer: "Paris" }
              : prompt.includes("Japan")
              ? { answer: "Tokyo" }
              : { answer: "Lyon" }
          )
        )
        const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
        const feedbackMetric = Metric.fromEffect("feedbackExactMatch", (prediction, expected) =>
          Effect.sync(() => {
            const predicted = answerText(prediction)
            const expectedAnswer = answerText(expected)
            const correct = predicted === expectedAnswer

            return new Metric.Result({
              score: correct
                ? 1
                : 0,
              feedback: correct
                ? "correct"
                : `expected ${expectedAnswer}, got ${predicted}`
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

        expect(paretoEvents.length).toBeGreaterThan(0)
        expect(params.instructions.length).toBeGreaterThan(0)
        expect(Option.isSome(Arr.findFirst(eventList, Optimizer.GEPAEvent.$is("AcceptanceEvaluated")))).toBe(true)
        expect(eventOrderFixture.payload.expectedWithinIterationOrder).toContain("AcceptanceEvaluated")
      })
  )
})
