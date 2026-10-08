import { expect, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Record, Ref, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { ScriptedFailure } from "../kit/Metric.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Answer = Schema.Struct({ answer: Schema.String })
const ScoredRow = Schema.Struct({
  id: Schema.String,
  prediction: Schema.Record(Schema.String, Schema.String),
  score: Schema.Finite
})
const ScoredRun = Schema.Struct({
  failureScore: Schema.Finite,
  maxErrors: Schema.Int,
  score: Schema.Finite,
  rows: Schema.NonEmptyArray(ScoredRow)
})
const CancelledRun = Schema.Struct({
  failureScore: Schema.Finite,
  maxErrors: Schema.Int,
  error: Schema.Literal("Exception"),
  message: Schema.Literal("Execution cancelled due to errors or interruption.")
})
const Run = Schema.Union([ScoredRun, CancelledRun])
const isScored = Schema.is(ScoredRun)
const Reference = Schema.Struct({
  splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.NonEmptyArray(Row) }),
  runs: Schema.NonEmptyArray(Run),
  history: Schema.NonEmptyArray(Schema.Struct({
    messages: Schema.Array(Schema.Struct({ role: Schema.String, content: Schema.String })),
    response: Schema.NonEmptyArray(Schema.String)
  }))
})

/** "[[ ## answer ## ]]\nlabel-0" -> "label-0"; the upstream ChatAdapter text for one output field. */
const fieldValue = (text: string) => Effect.fromOption(Arr.last(Str.split(text, "\n")))

it.effect("eval-failure-inclusive: every upstream run, failure score, ordered row and cancellation", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("eval-failure-inclusive", "upstream-execution")).payload
    )
    const qa = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const module = yield* Module.predict("qa", qa)
    // Replay the pinned DummyLM completions in their recorded order.
    const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(
      yield* Effect.forEach(
        reference.history,
        (call) => Effect.map(fieldValue(Arr.headNonEmpty(call.response)), (answer) => ({ answer }))
      )
    ))
    const examples = Arr.map(reference.splits.val, (row) =>
      new Example({
        id: Option.some(Id.make(row.id)),
        input: { question: row.question },
        labels: Option.some({ answer: row.answer })
      }))
    // The upstream metric: float(prediction.answer == example.answer), raising for val-1.
    const exact = Metric.withFeedback((example, prediction) =>
      Effect.gen(function*() {
        const id = yield* Effect.fromOption(example.id)
        yield* Effect.fail(new ScriptedFailure({ id })).pipe(Effect.when(Effect.succeed(id === "val-1")))
        const expected = yield* Schema.decodeUnknownEffect(Answer)(Option.getOrThrow(example.labels))
        const actual = yield* Schema.decodeUnknownEffect(Answer)(prediction.output)
        return new Metric.Score({
          value: Bool.match(actual.answer === expected.answer, { onTrue: () => 1, onFalse: () => 0 }),
          feedback: Option.none()
        })
      }), "exact")
    const evaluate = (run: typeof Run.Type) =>
      Evaluate.run(
        new Evaluate.Options({
          module,
          examples,
          metrics: { exact },
          concurrency: 1,
          failureScore: run.failureScore,
          maxErrors: Option.some(run.maxErrors)
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.result)
    const callsPerRun = yield* Ref.make(Arr.empty<number>())
    yield* Effect.forEach(reference.runs, (run, index) =>
      Effect.gen(function*() {
        const before = Arr.length(yield* Ref.get(mock.calls))
        const outcome = yield* evaluate(run)
        yield* Ref.update(callsPerRun, Arr.append(Arr.length(yield* Ref.get(mock.calls)) - before))
        yield* Match.value(run).pipe(
          Match.when(isScored, (scored) =>
            Effect.gen(function*() {
              const report = yield* Effect.fromResult(outcome)
              expect(report.average, `run ${index}`).toBe(scored.score)
              expect(report.overallScores.exact).toBe(scored.score)
              expect(report.totalExamples).toBe(Arr.length(scored.rows))
              expect(Arr.map(report.outcomes, (row) => Option.getOrThrow(row.example.id)))
                .toEqual(Arr.map(scored.rows, (row) => row.id))
              yield* Effect.forEach(Arr.zip(report.outcomes, scored.rows), ([actual, upstream]) =>
                Effect.sync(() =>
                  Match.value(actual).pipe(
                    Match.tag("Scored", (row) => {
                      expect(row.prediction.output).toEqual(upstream.prediction)
                      expect(row.score.value).toBe(upstream.score)
                    }),
                    // DSPy records an empty Prediction and failure_score for a failed row.
                    Match.tag("Failed", (row) => {
                      expect(upstream.prediction).toEqual({})
                      expect(upstream.score).toBe(run.failureScore)
                      expect(row.failure.index).toBe(row.index)
                    }),
                    Match.exhaustive
                  )
                ))
              expect(report.failureCount).toBe(
                Arr.length(Arr.filter(scored.rows, (row) => Record.isEmptyReadonlyRecord(row.prediction)))
              )
            })),
          // DSPy raises once errors reach max_errors; Theoria fails with the same >= budget.
          Match.orElse(() =>
            Effect.map(
              Effect.flip(Effect.fromResult(outcome)),
              (failure) =>
                expect(failure).toEqual(new Evaluate.TooManyErrors({ count: run.maxErrors, limit: run.maxErrors }))
            )
          )
        )
      }))
    // Every recorded LM call is replayed once and in order, including the cancelled run's calls.
    const calls = yield* Ref.get(mock.calls)
    expect(calls).toHaveLength(Arr.length(reference.history))
    const scoredCalls = Arr.map(
      reference.runs,
      (run) => Match.value(run).pipe(Match.when(isScored, (scored) => Arr.length(scored.rows)), Match.orElse(() => 0))
    )
    const total = Arr.reduce(scoredCalls, 0, (sum, count) => sum + count)
    expect(yield* Ref.get(callsPerRun)).toEqual(
      Arr.map(scoredCalls, (count) =>
        Bool.match(count === 0, {
          onTrue: () => Arr.length(reference.history) - total,
          onFalse: () => count
        }))
    )
    yield* Effect.forEach(Arr.zip(calls, reference.history), ([call, upstream]) =>
      Effect.gen(function*() {
        const user = yield* Effect.fromOption(Arr.last(upstream.messages))
        const question = yield* fieldValue(yield* Effect.fromOption(Arr.head(Str.split(user.content, "\n\n"))))
        expect(call.prompt).toContain(question)
      }))
  }))
