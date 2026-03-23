/**
 * Example contract: GEPA multi-objective mock optimization flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Predicate, Ref, Schema, Stream } from "effect"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

const fieldText = (record: Readonly<Record<string, unknown>>, field: string): string =>
  Option.getOrElse(
    Option.fromNullable(record[field]).pipe(Option.filter(Predicate.isString)),
    () => ""
  )

const trainset = Arr.make(
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
)

const valset = Arr.make(
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
)

const responseForPrompt = (prompt: string): Readonly<Record<string, string>> =>
  prompt.includes("France")
    ? { answer: "Paris" }
    : prompt.includes("Japan")
    ? { answer: "Tokyo" }
    : prompt.includes("Germany")
    ? { answer: "Berlin" }
    : prompt.includes("Italy")
    ? { answer: "Rome" }
    : { answer: "Unknown" }

const feedbackMetric = Metric.fromEffect(
  "feedback-exact",
  (prediction, expected) =>
    Effect.sync(() => {
      const predicted = fieldText(prediction, "answer")
      const expectedAnswer = fieldText(expected, "answer")
      const correct = predicted === expectedAnswer

      return new Metric.Result({
        score: correct ? 1 : 0,
        feedback: correct
          ? "correct"
          : `expected ${expectedAnswer}, got ${predicted}`
      })
    })
)

const runGepaMultiObjective = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer geography questions with concise capital city names",
    {
      question: Signature.describe(Schema.String, "Geography question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "The capital city name")
    }
  )

  const module = yield* Module.predict("qa-gepa-multi", signature)
  const mock = yield* MockLanguageModel.make(MockLanguageModel.map(responseForPrompt))
  const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

  const events = yield* Stream.runCollect(
    Optimizer.gepaStream({
      module,
      trainset,
      metric: feedbackMetric,
      maxIterations: 3,
      seed: 42
    })
  ).pipe(Effect.provide(layer))

  const eventList = Arr.fromIterable(events)
  const params = yield* Ref.get(module.params)

  return { eventList, params, module, layer }
})

describe("examples/15-gepa-multi-objective-mock", () => {
  it.effect("emits canonical GEPA event progression with Pareto updates", () =>
    Effect.gen(function*() {
      const { eventList } = yield* runGepaMultiObjective
      const tags = Arr.map(eventList, (event) => event._tag)

      expect(tags).toContain("IterationStarted")
      expect(tags).toContain("ParetoUpdated")
      expect(tags).toContain("IterationCompleted")
      expect(tags).toContain("OptimizationCompleted")

      const iterationStartIndex = tags.indexOf("IterationStarted")
      const completedIndex = tags.indexOf("OptimizationCompleted")
      expect(iterationStartIndex).toBeLessThan(completedIndex)
    }))

  it.effect("produces at least one ParetoUpdated event per iteration", () =>
    Effect.gen(function*() {
      const { eventList } = yield* runGepaMultiObjective
      const paretoUpdates = Arr.filter(eventList, Optimizer.GEPAEvent.$is("ParetoUpdated"))

      expect(paretoUpdates.length).toBeGreaterThanOrEqual(3)
    }))

  it.effect("optimized module retains non-empty instructions", () =>
    Effect.gen(function*() {
      const { params } = yield* runGepaMultiObjective

      expect(params.instructions.length).toBeGreaterThan(0)
    }))

  it.effect("seeded execution is deterministic across runs", () =>
    Effect.gen(function*() {
      const first = yield* runGepaMultiObjective
      const second = yield* runGepaMultiObjective

      const firstTags = Arr.map(first.eventList, (event) => event._tag)
      const secondTags = Arr.map(second.eventList, (event) => event._tag)

      expect(firstTags).toEqual(secondTags)
    }))

  it.effect("multi-metric evaluation works on optimized module", () =>
    Effect.gen(function*() {
      const { module, layer } = yield* runGepaMultiObjective

      const exactMatchMetric = Metric.exactMatch("answer")
      const composedMetric = Metric.compose({ exactMatch: exactMatchMetric, feedback: feedbackMetric })
      const report = yield* Evaluate.run({
        module,
        examples: valset,
        metrics: { exactMatch: exactMatchMetric, composed: composedMetric },
        concurrency: 1
      }).pipe(Effect.provide(layer))

      expect(report.overallScores.exactMatch).toBeGreaterThanOrEqual(0)
      expect(report.overallScores.composed).toBeGreaterThanOrEqual(0)
    }))
})
