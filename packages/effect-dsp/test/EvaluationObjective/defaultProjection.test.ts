/**
 * EvaluationObjective default projection: an absent metric name selects the report's
 * failure-inclusive average rather than any single named aggregate.
 */
import { expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import * as EvaluationObjective from "@scenesystems/effect-dsp/EvaluationObjective"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Effect, Option, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

// The task model always answers "Paris". Rows: correct, correct, wrong, malformed input.
// exact = [1, 1, 0, failed], half = [.5, .5, .5, failed], failureScore = 0.
// Per-row scores average the metrics: [.75, .75, .25, 0], so average = 1.75 / 4 = .4375.
// The named aggregates are exact = 2 / 4 = .5 and half = 1.5 / 4 = .375.
const report = Effect.gen(function*() {
  const module = yield* Module.predict(
    "qa",
    yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  )
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
  return yield* Evaluate.run(
    new Evaluate.Options({
      module,
      examples: [
        new Example({ input: { question: "France?" }, labels: Option.some({ answer: "Paris" }) }),
        new Example({ input: { question: "France, again?" }, labels: Option.some({ answer: "Paris" }) }),
        new Example({ input: { question: "Japan?" }, labels: Option.some({ answer: "Tokyo" }) }),
        new Example({ input: { question: 73 }, labels: Option.some({ answer: "Paris" }) })
      ],
      metrics: { exact: Metric.exactMatch("answer"), half: Metric.fromSync(() => 0.5, "half") }
    })
  ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
})

it.effect("an absent metric name projects the failure-inclusive report average, distinct from every named aggregate", () =>
  Effect.gen(function*() {
    const evaluated = yield* report
    expect(evaluated.overallScores).toEqual({ exact: 0.5, half: 0.375 })
    expect(evaluated.average).toBe(0.4375)
    const projection = yield* EvaluationObjective.projectSingleObjective(evaluated, Option.none())
    expect(projection.objective).toBe(0.4375)
    expect(projection.telemetry.totalExamples).toBe(4)
    expect(projection.telemetry.successCount).toBe(3)
    expect(projection.telemetry.failureCount).toBe(1)
    expect(projection.telemetry.failures).toEqual(evaluated.failures)
    expect(projection.telemetry.metricScores).toEqual([
      new EvaluationObjective.MetricScore({ name: "exact", score: 0.5 }),
      new EvaluationObjective.MetricScore({ name: "half", score: 0.375 })
    ])
    expect((yield* EvaluationObjective.projectSingleObjective(evaluated, Option.some("half"))).objective).toBe(0.375)
    expect((yield* EvaluationObjective.projectSingleObjective(evaluated, Option.some("exact"))).objective).toBe(0.5)
  }))

it.effect("single mode without metric names, or with an empty list, uses the default average; multi mode defaults to sorted names", () =>
  Effect.gen(function*() {
    const evaluated = yield* report
    expect((yield* EvaluationObjective.project({ report: evaluated, mode: "single" })).objective).toBe(0.4375)
    expect((yield* EvaluationObjective.project({ report: evaluated, mode: "single", metricNames: [] })).objective)
      .toBe(0.4375)
    expect(
      (yield* EvaluationObjective.project({ report: evaluated, mode: "single", metricNames: ["half", "exact"] }))
        .objective
    ).toBe(0.375)
    expect((yield* EvaluationObjective.project({ report: evaluated, mode: "multi" })).objective).toEqual([0.5, 0.375])
    expect(
      (yield* EvaluationObjective.project({ report: evaluated, mode: "multi", metricNames: ["half", "exact"] }))
        .objective
    ).toEqual([0.375, 0.5])
  }))
