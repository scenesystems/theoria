/**
 * Example contract: GEPA multi-objective mock optimization flow.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Layer,
  Match,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"

const AnswerResponse = Schema.Struct({
  answer: Signature.describe(Schema.String, "The capital city name")
})

const reflectiveResponse = Arr.of(
  Response.TextPart.make({
    text: "```\nAnswer geography questions with the exact, concise capital city name.\n```",
    metadata: {}
  })
)

const trainset = Arr.make(
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) }),
  new Example({ input: { question: "What is the capital of Germany?" }, labels: Option.some({ answer: "Berlin" }) })
)

const valset = Arr.make(
  new Example({ input: { question: "What is the capital of Italy?" }, labels: Option.some({ answer: "Rome" }) })
)

const responseForPrompt = (prompt: string) =>
  Match.value(prompt).pipe(
    Match.when(Str.includes("Your task is to write a new instruction"), () => reflectiveResponse),
    Match.when(Str.includes("France"), () => AnswerResponse.make({ answer: "Paris" })),
    Match.when(Str.includes("Japan"), () => AnswerResponse.make({ answer: "Tokyo" })),
    Match.when(Str.includes("Germany"), () => AnswerResponse.make({ answer: "Berlin" })),
    Match.when(Str.includes("Italy"), () => AnswerResponse.make({ answer: "Rome" })),
    Match.orElse(() => AnswerResponse.make({ answer: "Unknown" }))
  )

const feedbackMetric = Metric.withFeedback((example, result) =>
  Effect.gen(function*() {
    const prediction = yield* Schema.decodeUnknownEffect(Schema.toType(AnswerResponse))(result.output)
    const expected = yield* Schema.decodeUnknownEffect(AnswerResponse)(Option.getOrElse(example.labels, () => ({})))
    const predicted = prediction.answer
    const expectedAnswer = expected.answer
    const correct = Str.Equivalence(predicted, expectedAnswer)

    return Bool.match(correct, {
      onFalse: () =>
        new Metric.Score({
          value: 0,
          feedback: Option.some(Arr.join(Arr.make("expected ", expectedAnswer, ", got ", predicted), ""))
        }),
      onTrue: () => new Metric.Score({ value: 1, feedback: Option.some("correct") })
    })
  }), "feedback-exact")

const runGepaMultiObjective = Effect.gen(function*() {
  const signature = yield* Signature.make(
    "Answer geography questions with concise capital city names",
    {
      question: Signature.describe(Schema.String, "Geography question to answer")
    },
    AnswerResponse.fields
  )

  const module = yield* Module.predict("qa-gepa-multi", signature)
  const mock = yield* MockLanguageModel.make(MockLanguageModel.map(responseForPrompt))
  const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

  const recorded = yield* Ref.make(Arr.empty<GEPA.Event>())
  const compiled = yield* GEPA.runWithEvents(
    new GEPA.Options({
      module,
      trainset,
      metric: feedbackMetric,
      maxMetricCalls: 30,
      maxIterations: 3,
      seed: 42
    }),
    (event) => Ref.update(recorded, Arr.append(event))
  ).pipe(Effect.provide(layer))

  const eventList = yield* Ref.get(recorded)
  const parameters = Option.getOrThrow(Record.get(compiled.parameters, module.name))

  return new (class extends Data.Class<{
    readonly eventList: typeof eventList
    readonly parameters: typeof parameters
    readonly module: typeof module
    readonly layer: typeof layer
  }> {})({ eventList, parameters, module: compiled.program, layer })
})

describe("examples/gepa-multi-objective", () => {
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
      const ordered = Option.zipWith(iterationStartIndex, completedIndex, Num.isLessThan)

      expect(ordered).toEqual(Option.some(true))
    }))

  it.effect("produces at least one ParetoUpdated event per iteration", () =>
    Effect.gen(function*() {
      const { eventList } = yield* runGepaMultiObjective
      const paretoUpdates = Arr.filter(eventList, GEPA.events.$is("ParetoUpdated"))

      expect(Arr.length(paretoUpdates)).toBeGreaterThanOrEqual(3)
    }))

  it.effect("optimized module retains non-empty instructions", () =>
    Effect.gen(function*() {
      const { parameters } = yield* runGepaMultiObjective

      expect(Str.length(parameters.instructions)).toBeGreaterThan(0)
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
      const report = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: valset,
          metrics: { exactMatch: exactMatchMetric, composed: composedMetric },
          concurrency: 1
        })
      ).pipe(Effect.provide(layer))

      expect(report.successCount).toBe(1)
      expect(report.overallScores.exactMatch).toBe(1)
      expect(report.overallScores.composed).toBe(1)
    }))
})
