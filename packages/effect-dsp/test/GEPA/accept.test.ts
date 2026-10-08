/**
 * GEPA acceptance gates exercised through the production engine: the strict
 * mutation gate and the non-strict merge gate, including full-validation scheduling.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Record, Ref, Schema, String as Str, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example, Id } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Question = Schema.Struct({ question: Schema.String })
const Answer = Schema.Struct({ answer: Schema.String })
const rows = (ids: ReadonlyArray<string>) =>
  Arr.map(ids, (id) => new Example({ id: Option.some(Id.make(id)), input: { question: id }, labels: Option.none() }))
const MetricCall = Schema.Struct({ phase: Metric.Phase, id: Schema.String, instruction: Schema.String })

/** One reflective mutation of a single predictor, scored from an explicit (instruction, row) table. */
const runMutation = (table: Record.ReadonlyRecord<string, Record.ReadonlyRecord<string, number>>) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Task", Question.fields, Answer.fields)
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: "seed", demos: [], outputStrategy: "text" })
    })
    // The task model echoes the active instruction so the metric can index the table.
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Effect.succeed(
        `[[ ## answer ## ]]\n${
          Bool.match(Str.includes("child")(prompt), { onFalse: () => "seed", onTrue: () => "child" })
        }`
      )
    ))
    const calls = yield* Ref.make(Arr.empty<typeof MetricCall.Type>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const { question } = yield* Schema.decodeUnknownEffect(Question)(example.input)
        const { answer } = yield* Schema.decodeUnknownEffect(Answer)(prediction.output)
        const score = yield* Option.match(Record.get(table, answer).pipe(Option.flatMap(Record.get(question))), {
          onNone: () => Effect.sync(() => expect.fail(`no table score for ${answer}/${question}`)),
          onSome: Effect.succeed
        })
        yield* Ref.update(calls, Arr.append({ phase: context.phase, id: question, instruction: answer })).pipe(
          Effect.when(Effect.succeed(Option.isNone(context.target)))
        )
        return new Metric.Score({ value: score, feedback: Option.some("improve") })
      })
    )
    const events = yield* Ref.make(Arr.empty<GEPA.Event>())
    const result = yield* assertNoMutation(
      module,
      GEPA.runWithEvents(
        new GEPA.Options({
          module,
          metric,
          trainset: rows(["t0", "t1"]),
          valset: rows(["v0", "v1"]),
          seed: 0,
          maxMetricCalls: 100,
          maxIterations: 1,
          reflectionMinibatchSize: 2,
          skipPerfectScore: false,
          useMerge: false,
          instructionProposer: (_, components) =>
            Effect.succeed(
              Record.fromEntries(Arr.map(Arr.fromIterable(components), (component) => Tuple.make(component, "child")))
            )
        }),
        (event) => Ref.update(events, Arr.append(event))
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const acceptance = Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
      Match.value(event).pipe(
        Match.tag("AcceptanceEvaluated", (evaluated) => Option.some(evaluated)),
        Match.orElse(() => Option.none())
      )))
    return { result, acceptance, calls: yield* Ref.get(calls) }
  })

const validationCalls = (calls: ReadonlyArray<typeof MetricCall.Type>) =>
  Arr.filter(calls, (call) => call.phase === "select")

describe("GEPA production acceptance gates", () => {
  it.effect("the strict mutation gate rejects an equal minibatch sum and never evaluates the child on validation", () =>
    Effect.gen(function*() {
      // Exact binary scores: seed [.25, .5] and child [.5, .25] both sum to .75.
      const { acceptance, calls, result } = yield* runMutation({
        seed: { t0: 0.25, t1: 0.5, v0: 0.25, v1: 0.25 },
        child: { t0: 0.5, t1: 0.25, v0: 1, v1: 1 }
      })
      expect(Arr.map(acceptance, (event) => ({
        accepted: event.accepted,
        gate1Passed: event.gate1Passed,
        fullValsetEvaluated: event.fullValsetEvaluated,
        previousSubsampleSum: event.previousSubsampleSum,
        mutatedSubsampleSum: event.mutatedSubsampleSum
      }))).toEqual([{
        accepted: false,
        gate1Passed: false,
        fullValsetEvaluated: false,
        previousSubsampleSum: 0.75,
        mutatedSubsampleSum: 0.75
      }])
      // Only the initial seed validation runs; the child's perfect validation scores are never observed.
      expect(validationCalls(calls)).toEqual([
        { phase: "select", id: "v0", instruction: "seed" },
        { phase: "select", id: "v1", instruction: "seed" }
      ])
      expect(Arr.filter(calls, (call) => call.instruction === "child" && call.phase !== "search")).toEqual([])
      expect(result.report.metricCalls).toBe(6)
      expect(result.report.optimizationBestCandidateId).toBe("candidate-0")
      expect(Option.getOrThrow(Record.get(result.parameters, "qa")).instructions).toBe("seed")
    }))

  it.effect("a strict minibatch improvement runs one full child validation and the better candidate is returned", () =>
    Effect.gen(function*() {
      // seed [.25, .5] = .75 < child [.5, .5] = 1; validation aggregates .25 versus .75.
      const { acceptance, calls, result } = yield* runMutation({
        seed: { t0: 0.25, t1: 0.5, v0: 0.25, v1: 0.25 },
        child: { t0: 0.5, t1: 0.5, v0: 0.75, v1: 0.75 }
      })
      expect(Arr.map(acceptance, (event) => ({
        accepted: event.accepted,
        gate1Passed: event.gate1Passed,
        fullValsetEvaluated: event.fullValsetEvaluated,
        previousSubsampleSum: event.previousSubsampleSum,
        mutatedSubsampleSum: event.mutatedSubsampleSum
      }))).toEqual([{
        accepted: true,
        gate1Passed: true,
        fullValsetEvaluated: true,
        previousSubsampleSum: 0.75,
        mutatedSubsampleSum: 1
      }])
      expect(validationCalls(calls)).toEqual([
        { phase: "select", id: "v0", instruction: "seed" },
        { phase: "select", id: "v1", instruction: "seed" },
        { phase: "select", id: "v0", instruction: "child" },
        { phase: "select", id: "v1", instruction: "child" }
      ])
      expect(result.report.metricCalls).toBe(8)
      expect(Option.getOrThrow(result.report.state).scoreVectors).toEqual([[0.25, 0.25], [0.75, 0.75]])
      expect(result.report.optimizationBestCandidateId).toBe("candidate-1")
      expect(Option.getOrThrow(Record.get(result.parameters, "qa")).instructions).toBe("child")
    }))
})

// Merge scenario: the gepa-merge-accepted datasets and parent table, with the merged
// program's validation row replaced. Its sampled merge rows are val-1, val-2, val-5, val-6, val-0,
// where the parents sum to .8 + .8 + .05 + .05 + .8 = 2.5 (left/seed) and .1 + .1 + .9 + .9 + .1 = 2.1 (seed/right).
const Row = Schema.Struct({ id: Schema.String, split: Schema.String, index: Schema.Int })
const MergeReference = Schema.Struct({
  seed: Schema.Int,
  maxMetricCalls: Schema.Int,
  train: Schema.Array(Row),
  val: Schema.Array(Row),
  validationScores: Schema.Record(Schema.String, Schema.Array(Schema.Finite))
})
const MergeCall = Schema.Struct({ id: Schema.String, candidate: Schema.String })

const runMerge = (merged: ReadonlyArray<number>) =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(MergeReference)(
      (yield* fixture("gepa-merge-accepted", "upstream-execution")).payload
    )
    const validationScores = Record.set(reference.validationScores, "left/right", merged)
    const signature = yield* Signature.make("Task", Question.fields, Answer.fields)
    const qa = yield* Module.predict("qa", signature)
    const judge = yield* Module.predict("judge", signature)
    const module = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature: yield* Signature.make("Task", Row.fields, { qa: Schema.String, judge: Schema.String }),
        subModules: { draft: qa, judge },
        forward: ({ input }) =>
          Effect.gen(function*() {
            return {
              qa: (yield* qa.forward({ question: input.id })).answer,
              judge: (yield* judge.forward({ question: input.id })).answer
            }
          })
      })
    )
    yield* Module.install(
      module,
      Record.map(
        { "root.draft": "seed", "root.judge": "seed" },
        (instruction) => new ModuleParameters({ instructions: instruction, demos: [], outputStrategy: "text" })
      )
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Effect.succeed(
        `[[ ## answer ## ]]\n${
          Option.getOrThrow(
            Str.match(/Instructions: (seed|left|right)/)(prompt).pipe(Option.flatMap((match) => Arr.get(match, 1)))
          )
        }`
      )
    ))
    const calls = yield* Ref.make(Arr.empty<typeof MergeCall.Type>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const row = yield* Schema.decodeUnknownEffect(Row)(example.input)
        const output = yield* Schema.decodeUnknownEffect(Schema.Struct({ qa: Schema.String, judge: Schema.String }))(
          prediction.output
        )
        const candidate = `${output.qa}/${output.judge}`
        const score = yield* Bool.match(row.split === "train", {
          onTrue: () =>
            Effect.succeed(
              0.2 + 0.2 * Arr.filter([output.qa, output.judge], (instruction) => instruction !== "seed").length
            ),
          onFalse: () =>
            Option.match(Record.get(validationScores, candidate).pipe(Option.flatMap(Arr.get(row.index))), {
              onNone: () => Effect.sync(() => expect.fail(`no validation score for ${candidate}/${row.id}`)),
              onSome: Effect.succeed
            })
        })
        yield* Ref.update(calls, Arr.append({ id: row.id, candidate })).pipe(
          Effect.when(Effect.succeed(Option.isNone(context.target)))
        )
        return new Metric.Score({ value: score, feedback: Option.some("improve") })
      })
    )
    const events = yield* Ref.make(Arr.empty<GEPA.Event>())
    const examples = (split: ReadonlyArray<typeof Row.Type>) =>
      Arr.map(split, (row) => new Example({ id: Option.some(Id.make(row.id)), input: row, labels: Option.none() }))
    const result = yield* assertNoMutation(
      module,
      GEPA.runWithEvents(
        new GEPA.Options({
          module,
          metric,
          trainset: examples(reference.train),
          valset: examples(reference.val),
          seed: reference.seed,
          maxMetricCalls: reference.maxMetricCalls,
          maxIterations: 3,
          skipPerfectScore: false,
          instructionProposer: (_, components) =>
            Effect.succeed(
              Record.fromEntries(
                Arr.map(
                  Arr.fromIterable(components),
                  (component) =>
                    Tuple.make(
                      component,
                      Bool.match(component === "root.draft", { onFalse: () => "right", onTrue: () => "left" })
                    )
                )
              )
            )
        }),
        (event) => Ref.update(events, Arr.append(event))
      )
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    const merges = Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
      Match.value(event).pipe(
        Match.tag("MergeChecked", (checked) =>
          Option.liftPredicate({ iteration: checked.iteration, accepted: checked.accepted }, () => checked.attempted)),
        Match.orElse(() =>
          Option.none()
        )
      )))
    const mergedCalls = Arr.map(
      Arr.filter(yield* Ref.get(calls), (call) => call.candidate === "left/right"),
      (call) => call.id
    )
    return { result, merges, mergedCalls }
  })

describe("GEPA production merge gate", () => {
  it.effect("accepts a merged subsample sum exactly equal to the best parent and then validates it fully", () =>
    Effect.gen(function*() {
      // .5 * 5 = 2.5 ties left/seed's 2.5 exactly; a strict comparator would reject it.
      const { merges, mergedCalls, result } = yield* runMerge(Arr.replicate(0.5, 7))
      expect(merges).toEqual([{ iteration: 3, accepted: true }])
      expect(mergedCalls).toEqual([
        "val-1",
        "val-2",
        "val-5",
        "val-6",
        "val-0",
        "val-0",
        "val-1",
        "val-2",
        "val-3",
        "val-4",
        "val-5",
        "val-6"
      ])
      const state = Option.getOrThrow(result.report.state)
      expect(state.acceptedMerges).toBe(1)
      expect(Arr.length(state.candidates)).toBe(4)
      expect(Arr.last(state.scoreVectors)).toEqual(Option.some(Arr.replicate(0.5, 7)))
      // Aggregates: seed .214, left/seed .371, seed/right .557, merged .5, so seed/right is returned.
      expect(result.report.optimizationBestCandidateId).toBe("candidate-2")
      expect(Record.map(result.parameters, (parameters) => parameters.instructions)).toEqual({
        "root.draft": "seed",
        "root.judge": "right"
      })
    }))

  it.effect("rejects a merged subsample sum below the best parent even when it beats the other parent", () =>
    Effect.gen(function*() {
      // .4375 * 5 = 2.1875: above seed/right's 2.1 but below left/seed's 2.5.
      const { merges, mergedCalls, result } = yield* runMerge(Arr.replicate(0.4375, 7))
      expect(merges).toEqual([{ iteration: 3, accepted: false }])
      expect(mergedCalls).toEqual(["val-1", "val-2", "val-5", "val-6", "val-0"])
      const state = Option.getOrThrow(result.report.state)
      expect(state.acceptedMerges).toBe(0)
      expect(Arr.length(state.candidates)).toBe(3)
      expect(result.report.optimizationBestCandidateId).toBe("candidate-2")
    }))
})
