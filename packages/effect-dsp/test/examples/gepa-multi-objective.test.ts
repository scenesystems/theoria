/**
 * Example contract: GEPA multi-objective mock optimization flow.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Layer,
  Match,
  Number as Num,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"

class AnswerResponse extends Schema.Class<AnswerResponse>("AnswerResponse")({
  answer: Schema.String
}) {}

const answerText = (record: unknown): string =>
  Schema.decodeUnknownOption(AnswerResponse)(record).pipe(
    Option.map((response) => response.answer),
    Option.getOrElse(() => Str.empty)
  )

const reflectiveResponse = Arr.of(
  Response.textPart({
    text: "```\nAnswer geography questions with the exact, concise capital city name.\n```"
  })
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

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => new AnswerResponse({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => new AnswerResponse({ answer: "Tokyo" })),
    Match.when(Str.includes("Germany"), () => new AnswerResponse({ answer: "Berlin" })),
    Match.when(Str.includes("Italy"), () => new AnswerResponse({ answer: "Rome" })),
    Match.orElse(() => new AnswerResponse({ answer: "Unknown" }))
  )

const feedbackMetric = Metric.fromEffect(
  "feedback-exact",
  (prediction, expected) =>
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

  return Data.struct({ eventList, params, module, layer })
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

      const iterationStartIndex = Arr.findFirstIndex(tags, (tag) => Str.Equivalence(tag, "IterationStarted"))
      const completedIndex = Arr.findFirstIndex(tags, (tag) => Str.Equivalence(tag, "OptimizationCompleted"))
      const ordered = Option.zipWith(iterationStartIndex, completedIndex, Num.lessThan)

      expect(ordered).toEqual(Option.some(true))
    }))

  it.effect("produces at least one ParetoUpdated event per iteration", () =>
    Effect.gen(function*() {
      const { eventList } = yield* runGepaMultiObjective
      const paretoUpdates = Arr.filter(eventList, Optimizer.GEPAEvent.$is("ParetoUpdated"))

      expect(Arr.length(paretoUpdates)).toBeGreaterThanOrEqual(3)
    }))

  it.effect("optimized module retains non-empty instructions", () =>
    Effect.gen(function*() {
      const { params } = yield* runGepaMultiObjective

      expect(Str.length(params.instructions)).toBeGreaterThan(0)
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
