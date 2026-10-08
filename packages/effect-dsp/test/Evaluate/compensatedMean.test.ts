import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Option, Record, Schema, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Evaluate from "../../src/Evaluate.js"
import { Example } from "../../src/Example.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"

const Reference = Schema.Struct({
  grades: Schema.Array(Schema.Finite),
  scores: Schema.Array(Schema.Finite),
  mean: Schema.Finite,
  composedScore: Schema.Finite
})
const reference = fixture("eval-compensated-mean", "upstream-execution").pipe(
  Effect.flatMap((value) => Schema.decodeUnknownEffect(Reference)(value.payload))
)
const setup = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  return {
    module: yield* Module.predict("qa", signature),
    mock: yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
  }
})
const valueMetric = (value: number) => Metric.fromSync(() => value)

it.effect("eval-compensated-mean: overall and per-metric means use the recorded builtin score sum", () =>
  Effect.gen(function*() {
    const expected = yield* reference
    const { module, mock } = yield* setup
    const report = yield* Evaluate.run(
      new Evaluate.Options({
        module,
        examples: Arr.map(
          expected.grades,
          (grade, index) => new Example({ input: { question: `q${index}` }, labels: Option.some({ grade }) })
        ),
        metrics: {
          accuracy: Metric.withFeedback((example) =>
            Schema.decodeUnknownEffect(Schema.Struct({ grade: Schema.Finite }))(Option.getOrThrow(example.labels)).pipe(
              Effect.map(({ grade }) => new Metric.Score({ value: grade, feedback: Option.none() }))
            )
          )
        }
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(Arr.map(report.outcomes, (outcome) =>
      Match.valueTags(outcome, {
        Scored: (value) => value.score.value,
        Failed: () => expect.fail("Expected all recorded rows to score")
      }))).toEqual(expected.scores)
    expect(report.overallScores.accuracy).toBe(expected.mean)
    expect(report.average).toBe(expected.mean)
  }))

it.effect("eval-compensated-mean: composed metrics and per-example means retain the same builtin sum", () =>
  Effect.gen(function*() {
    const expected = yield* reference
    const { module, mock } = yield* setup
    const metrics = Record.fromEntries(
      Arr.map(expected.grades, (grade, index) => Tuple.make(`g${index}`, valueMetric(grade)))
    )
    const run = (metrics: Record.ReadonlyRecord<string, Metric.Metric>) =>
      Evaluate.run(new Evaluate.Options({ module, metrics, examples: [new Example({ input: { question: "q" } })] }))
        .pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const composed = yield* run({ composed: Metric.compose(metrics) })
    const individual = yield* run(metrics)
    yield* Effect.forEach([composed, individual], (report) =>
      Effect.sync(() => {
        expect(report.average).toBe(expected.composedScore)
        Match.valueTags(Option.getOrThrow(Arr.head(report.outcomes)), {
          Scored: (value) => expect(value.score.value).toBe(expected.composedScore),
          Failed: () => expect.fail("Expected the recorded mean metric to score")
        })
      }))
  }))
