import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Evaluate from "../../src/Evaluate.js"
import * as Example from "../../src/Example.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { Prediction } from "../../src/Prediction.js"
import * as Predictor from "../../src/Predictor.js"
import * as Signature from "../../src/Signature.js"
import * as Trace from "../../src/Trace.js"

describe("prediction and metric contracts", () => {
  it.effect("retains the execution target supplied by a per-predictor caller", () =>
    Effect.gen(function*() {
      const trace = new Trace.Program({ selected: Chunk.empty(), attempts: Chunk.empty(), usage: Trace.emptyUsage })
      const target = new Metric.Target({
        predictorId: yield* Schema.decodeEffect(Predictor.Id)("qa.answer"),
        execution: yield* Schema.decodeEffect(Trace.Execution.Id)("attempt-17")
      })
      const context = new Metric.Context({ phase: "reflect", trace: Option.some(trace), target: Option.some(target) })
      const metric = Metric.withFeedback((_example, _prediction, received) =>
        Effect.sync(() => {
          expect(received).toBe(context)
          expect(received.target).toEqual(Option.some(target))
          return new Metric.Score({ value: 0.3, feedback: Option.none() })
        })
      )
      const result = yield* metric.score(
        new Example.Example({ input: {} }),
        new Prediction({
          output: {},
          trace,
          usage: trace.usage
        }),
        context
      )
      expect(result.value).toBe(0.3)
    }))

  it.effect("normalizes answer equality and uses token boundaries for passage matching", () =>
    Effect.gen(function*() {
      const trace = new Trace.Program({ selected: Chunk.empty(), attempts: Chunk.empty(), usage: Trace.emptyUsage })
      const context = new Metric.Context({ phase: "evaluate", trace: Option.some(trace), target: Option.none() })
      const example = new Example.Example({ input: {}, labels: Option.some({ answer: ["York", "The Café!"] }) })
      const exact = yield* Metric.answerExactMatch().score(
        example,
        new Prediction({
          output: { answer: "café" },
          trace,
          usage: trace.usage
        }),
        context
      )
      expect(exact.value).toBe(1)
      const absent = yield* Metric.answerPassageMatch().score(
        example,
        new Prediction({
          output: { context: ["Yorkshire"] },
          trace,
          usage: trace.usage
        }),
        context
      )
      expect(absent.value).toBe(0)
      const present = yield* Metric.answerPassageMatch().score(
        example,
        new Prediction({
          output: { context: ["New York City"] },
          trace,
          usage: trace.usage
        }),
        context
      )
      expect(present.value).toBe(1)
    }))

  it.effect("passes raw labels independently of the output schema", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("answer", signature)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map(() => ({ answer: "Paris" })))
      const example = new Example.Example({
        id: Option.none(),
        input: { question: "Capital?" },
        labels: Option.some({ answer: "Paris", gradingNote: "extra label" }),
        metadata: Option.none()
      })
      const metric = Metric.withFeedback((row, prediction, context) =>
        Effect.sync(() => {
          expect(row.labels).toEqual(Option.some({ answer: "Paris", gradingNote: "extra label" }))
          expect(prediction.output).toEqual({ answer: "Paris" })
          expect(context.phase).toBe("evaluate")
          expect(Option.isSome(context.trace)).toBe(true)
          return new Metric.Score({ value: 0.75, feedback: Option.some("graded") })
        })
      )
      const report = yield* Evaluate.run(
        new Evaluate.Options({ module, examples: [example], metrics: { accuracy: metric } })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(report.overallScores.accuracy).toBe(0.75)
    }))

  it.effect("Module.call returns decoded output with invocation trace and usage", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("answer", signature)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map(() => ({ answer: "Paris" })))
      const prediction = yield* Module.call(module, { question: "Capital?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(prediction.output).toEqual({ answer: "Paris" })
      expect(Chunk.size(prediction.trace.selected)).toBe(1)
      expect(prediction.usage.callCount).toBe(1)
      expect(prediction.trace.usage).toEqual(prediction.usage)
    }))

  it.effect("derives identity from input and labels, not metadata or property order", () =>
    Effect.gen(function*() {
      const first = new Example.Example({
        id: Option.none(),
        input: { b: 2, a: 1 },
        labels: Option.some({ answer: "yes" }),
        metadata: Option.none()
      })
      const reordered = new Example.Example({
        id: Option.none(),
        input: { a: 1, b: 2 },
        labels: first.labels,
        metadata: Option.some({ source: "other" })
      })
      const changed = new Example.Example({ input: first.input, labels: Option.some({ answer: "no" }) })
      expect(yield* Example.id(first)).toBe(yield* Example.id(reordered))
      expect(yield* Example.id(first)).not.toBe(yield* Example.id(changed))
    }))
})
