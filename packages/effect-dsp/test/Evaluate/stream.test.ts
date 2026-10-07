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
import { Array as Arr, Effect, Layer, Match, Option, Schema, Stream } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { constVoid } from "effect/Function"

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
  it.effect("preserves run/stream parity over success and failure semantics", () =>
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
      const failedEvent = Arr.findFirst(events, (event) => event._tag === "ExampleFailed")
      const completion = Arr.last(events)

      expect(counts.started).toBe(report.totalExamples)
      expect(counts.completed).toBe(report.successCount)
      expect(counts.failed).toBe(report.failureCount)
      expect(counts.finished).toBe(1)
      expect(Option.isSome(completion)).toBe(true)

      Option.match(failedEvent, {
        onNone: constVoid,
        onSome: (event) =>
          Match.value(event).pipe(
            Match.tag("ExampleFailed", (failed) => {
              expect(failed.failure.index).toBe(2)
              expect(failed.failure.tag).toBe("EvaluationFailed")
            }),
            Match.orElse(constVoid)
          )
      })

      Option.match(completion, {
        onNone: constVoid,
        onSome: (event) => {
          expect(event._tag).toBe("EvaluationCompleted")

          Match.value(event).pipe(
            Match.tag("EvaluationCompleted", (completed) => {
              expect(completed.total).toBe(report.totalExamples)
              expect(completed.overallScore).toBe(report.overallScores.exact)
            }),
            Match.orElse(constVoid)
          )
        }
      })
    }))
})
