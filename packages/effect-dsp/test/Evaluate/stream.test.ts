/**
 * Evaluate.stream contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Layer, Option, Stream } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Evaluate.stream", () => {
  it.effect("preserves run/stream parity over success and failure semantics", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const options = {
        module,
        examples: [
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          }),
          new Example({
            input: { question: "What is the capital of Canada?" }
          })
        ],
        metrics: {
          exact: Metric.exactMatch("answer")
        },
        concurrency: 2
      }

      const report = yield* Evaluate.run(options).pipe(
        Effect.provide(layer)
      )
      const eventsChunk = yield* Evaluate.stream(options).pipe(
        Stream.runCollect,
        Effect.provide(layer)
      )
      const events = Chunk.toReadonlyArray(eventsChunk)
      const counts = Arr.reduce(
        events,
        { started: 0, completed: 0, failed: 0, finished: 0 },
        (state, event) =>
          Evaluate.EvaluationEvent.$match({
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

      if (Option.isSome(failedEvent) && failedEvent.value._tag === "ExampleFailed") {
        expect(failedEvent.value.failure.index).toBe(2)
        expect(failedEvent.value.failure.tag).toBe("EvaluationFailed")
      }

      if (Option.isSome(completion)) {
        expect(completion.value._tag).toBe("EvaluationCompleted")

        if (completion.value._tag === "EvaluationCompleted") {
          expect(completion.value.total).toBe(report.totalExamples)
          expect(completion.value.overallScore).toBe(report.overallScores.exact)
        }
      }
    }))
})
