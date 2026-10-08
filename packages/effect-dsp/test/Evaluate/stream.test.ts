/**
 * Evaluate.stream contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Layer, Match, Option, Result, Schema, Stream } from "effect"
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

describe("Evaluate.stream", () => {
  it.effect("preserves run/stream parity with exactly one failed row at index 2 and a terminal completion", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const options = new Evaluate.Options({
        module,
        examples: [
          new Example({
            input: { question: "What is the capital of France?" },
            labels: Option.some({ answer: "Paris" })
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            labels: Option.some({ answer: "Tokyo" })
          }),
          new Example({
            input: { question: 73 }
          })
        ],
        metrics: {
          exact: Metric.exactMatch("answer")
        },
        concurrency: 2
      })

      const report = yield* Evaluate.run(options).pipe(
        Effect.provide(layer)
      )
      const eventsChunk = yield* Evaluate.stream(options).pipe(
        Stream.runCollect,
        Effect.provide(layer)
      )
      const events = eventsChunk
      const counts = Arr.reduce(
        events,
        { started: 0, completed: 0, failed: 0, finished: 0 },
        (state, event) =>
          Evaluate.events.$match({
            ExampleStarted: () => ({ ...state, started: state.started + 1 }),
            ExampleCompleted: () => ({ ...state, completed: state.completed + 1 }),
            ExampleFailed: () => ({ ...state, failed: state.failed + 1 }),
            EvaluationCompleted: () => ({ ...state, finished: state.finished + 1 })
          })(event)
      )
      const failedEvents = Arr.filterMap(events, (event) =>
        Match.value(event).pipe(
          Match.tag("ExampleFailed", (failed) => Result.succeed(failed.failure)),
          Match.orElse(() => Result.failVoid)
        ))
      const completion = Arr.last(events)

      // Only the third row (non-string question) fails; both string rows are scored.
      expect(report.totalExamples).toBe(3)
      expect(report.successCount).toBe(2)
      expect(report.failureCount).toBe(1)
      expect(counts).toEqual({ started: 3, completed: 2, failed: 1, finished: 1 })
      expect(counts.started).toBe(report.totalExamples)
      expect(counts.completed).toBe(report.successCount)
      expect(counts.failed).toBe(report.failureCount)
      expect(Arr.map(failedEvents, (failure) => ({ index: failure.index, tag: failure.tag }))).toEqual([
        { index: 2, tag: "EvaluationFailed" }
      ])
      expect(failedEvents).toEqual(report.failures)

      Option.match(completion, {
        onNone: () => expect.fail("Evaluate.stream emitted no events"),
        onSome: (event) =>
          Match.value(event).pipe(
            Match.tag("EvaluationCompleted", (completed) => {
              expect(completed.total).toBe(report.totalExamples)
              expect(completed.overallScore).toBe(report.overallScores.exact)
            }),
            Match.orElse((other) => expect.fail(`last Evaluate.stream event was ${other._tag}`))
          )
      })
    }))
})
