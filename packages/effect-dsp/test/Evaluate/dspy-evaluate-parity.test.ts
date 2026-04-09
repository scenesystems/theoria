import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Layer, Option, Schema, Stream } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"

import {
  EvaluateEventOrderFixtureSchema,
  EvaluateReportShapeFixtureSchema,
  FixtureRegistry
} from "../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const exampleOutput = (expectedAnswer: string | null): Readonly<Record<string, unknown>> =>
  Option.match(Option.fromNullable(expectedAnswer), {
    onNone: () => ({}),
    onSome: (answer) => ({
      output: {
        answer
      }
    })
  })

const projectedEvent = (event: Evaluate.EvaluationEventType) =>
  Evaluate.EvaluationEvent.$match({
    ExampleStarted: ({ index, total }) => ({ _tag: "ExampleStarted", index, total }),
    ExampleCompleted: ({ index, score }) => ({ _tag: "ExampleCompleted", index, score }),
    ExampleFailed: ({ failure }) => ({ _tag: "ExampleFailed", index: failure.index }),
    EvaluationCompleted: ({ overallScore, total }) => ({
      _tag: "EvaluationCompleted",
      overallScore,
      total
    })
  })(event)

describe("Evaluate DSPy parity", () => {
  it.effect("matches fixture-backed report and event-order contracts", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawReportFixture = yield* registry.load("dspy.evaluate.report-shape.basic")
      const rawEventFixture = yield* registry.load("dspy.evaluate.event-order.basic")
      const reportFixture = yield* Schema.decodeUnknown(EvaluateReportShapeFixtureSchema)(rawReportFixture)
      const eventFixture = yield* Schema.decodeUnknown(EvaluateEventOrderFixtureSchema)(rawEventFixture)

      const fixtureExamples = reportFixture.payload.examples
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-evaluate-dspy-parity", signature)
      const answerForQuestion = (question: string): string =>
        Option.getOrElse(
          Arr.findFirst(fixtureExamples, (example) => question.includes(example.question)).pipe(
            Option.flatMap((example) => Option.fromNullable(example.predictedAnswer))
          ),
          () => ""
        )

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) => ({
          answer: answerForQuestion(prompt)
        }))
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const examples = Arr.map(
        fixtureExamples,
        (example) =>
          new Example({
            input: {
              question: example.question
            },
            ...exampleOutput(example.expectedAnswer)
          })
      )
      const options = {
        module,
        examples,
        metrics: {
          exact: Metric.exactMatch("answer")
        },
        concurrency: 1
      }

      const report = yield* Evaluate.run(options).pipe(
        Effect.provide(layer)
      )
      const eventsChunk = yield* Evaluate.stream(options).pipe(
        Stream.runCollect,
        Effect.provide(layer)
      )
      const events = Chunk.toReadonlyArray(eventsChunk)
      const projectedEvents = Arr.map(events, projectedEvent)
      const projectedReportExamples = Arr.map(report.results, (result) => ({
        index: result.index,
        score: Option.match(result.failure, {
          onNone: () => result.scores.exact ?? 0,
          onSome: () => 0
        }),
        failure: Option.isSome(result.failure)
      }))
      const fixtureReportExamples = Arr.map(fixtureExamples, (example) => ({
        index: example.index,
        score: example.score,
        failure: example.failure
      }))

      expect(report.totalExamples).toBe(reportFixture.payload.totalExamples)
      expect(report.successCount).toBe(reportFixture.payload.successCount)
      expect(report.failureCount).toBe(reportFixture.payload.failureCount)
      expect(report.overallScores.exact).toBe(reportFixture.payload.successfulScoreFraction)
      expect(projectedReportExamples).toStrictEqual(fixtureReportExamples)

      expect(projectedEvents).toStrictEqual(eventFixture.payload.events)
      expect(projectedEvents).toHaveLength(eventFixture.payload.eventCount)
      expect(
        Arr.filterMap(projectedEvents, (event) =>
          event._tag === "ExampleCompleted" && "index" in event
            ? Option.some(event.index)
            : Option.none<number>())
      ).toStrictEqual(eventFixture.payload.completedIndices)
      expect(
        Arr.filterMap(projectedEvents, (event) =>
          event._tag === "ExampleFailed" && "index" in event
            ? Option.some(event.index)
            : Option.none<number>())
      ).toStrictEqual(eventFixture.payload.failedIndices)
    }))
})
