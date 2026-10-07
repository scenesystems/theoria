/**
 * GEPA aggregate, acceptance and pruning sums against pinned GEPA builtin-sum ties.
 */
import { expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Match, Option, Record, Ref, Schema, String as Str, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example, Id } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import {
  evaluateMergeAcceptance,
  evaluateMutationAcceptance,
  EvaluateMutationAcceptanceOptions
} from "../../src/internal/gepa/accept.js"
import { deriveParetoKernelSnapshot } from "../../src/internal/gepa/frontier.js"
import { bestIndex } from "../../src/internal/gepa/runtime/mutation.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Vector = Schema.Array(Schema.Finite)
const Kernels = Schema.Struct({
  aggregate: Schema.Struct({
    scoreVectors: Schema.Array(Vector),
    aggregates: Vector,
    idxmax: Schema.Int,
    bestIndex: Schema.Int
  }),
  mutation: Schema.Struct({
    before: Vector,
    after: Vector,
    beforeSum: Schema.Finite,
    afterSum: Schema.Finite,
    accepted: Schema.Boolean
  }),
  merge: Schema.Struct({
    merged: Vector,
    parentA: Vector,
    parentB: Vector,
    mergedSum: Schema.Finite,
    bestParentSum: Schema.Finite,
    accepted: Schema.Boolean
  }),
  pruning: Schema.Struct({
    scoreVectors: Schema.Array(Vector),
    aggregates: Vector,
    frontierIndices: Schema.Array(Schema.Int),
    parentCatalogue: Schema.Array(Schema.Int)
  })
})
const Row = Schema.Struct({ id: Schema.String, index: Schema.Int })
const Run = Schema.Struct({
  seed: Schema.Int,
  maxMetricCalls: Schema.Int,
  table: Schema.Record(Schema.String, Vector),
  rows: Schema.NonEmptyArray(Row),
  calls: Schema.Array(Schema.Struct({ id: Schema.String, instruction: Schema.String, score: Schema.Finite })),
  rejected: Schema.Array(Schema.Struct({ beforeSum: Schema.Finite, afterSum: Schema.Finite })),
  iterations: Schema.Array(Schema.Struct({ iteration: Schema.Int, accepted: Schema.Boolean })),
  candidates: Schema.NonEmptyArray(Schema.Struct({ qa: Schema.String })),
  bestIndex: Schema.Int
})

const kernels = Effect.gen(function*() {
  return yield* Schema.decodeUnknownEffect(Kernels)((yield* fixture("gepa-sum-kernels-001", "upstream-kernel")).payload)
})

it.effect("gepa-sum-kernels-001: aggregate ties keep GEPAResult.best_idx", () =>
  Effect.gen(function*() {
    const reference = (yield* kernels).aggregate
    expect(bestIndex(reference.scoreVectors)).toBe(reference.bestIndex)
    expect(bestIndex(reference.scoreVectors)).toBe(reference.idxmax)
  }))

it.effect("gepa-sum-kernels-001: the strict mutation gate rejects a builtin-sum tie", () =>
  Effect.gen(function*() {
    const reference = (yield* kernels).mutation
    const acceptance = yield* evaluateMutationAcceptance(
      new EvaluateMutationAcceptanceOptions({
        previousSubsampleScores: reference.before,
        mutatedSubsampleScores: reference.after,
        evaluateFullValset: Effect.succeed(reference.after)
      })
    )
    expect(acceptance.previousSubsampleSum).toBe(reference.beforeSum)
    expect(acceptance.mutatedSubsampleSum).toBe(reference.afterSum)
    expect(acceptance.gate1Passed).toBe(reference.accepted)
  }))

it.effect("gepa-sum-kernels-001: the non-strict merge gate accepts a builtin-sum tie", () =>
  Effect.gen(function*() {
    const reference = (yield* kernels).merge
    const acceptance = evaluateMergeAcceptance({
      mergedSubsampleScores: reference.merged,
      parentASubsampleScores: reference.parentA,
      parentBSubsampleScores: reference.parentB
    })
    expect(acceptance.mergedSubsampleSum).toBe(reference.mergedSum)
    expect(acceptance.bestParentSubsampleSum).toBe(reference.bestParentSum)
    expect(acceptance.accepted).toBe(reference.accepted)
  }))

it.effect("gepa-sum-kernels-001: aggregate-ordered pruning and parent weights follow remove_dominated_programs", () =>
  Effect.gen(function*() {
    const reference = (yield* kernels).pruning
    const snapshot = deriveParetoKernelSnapshot(reference.scoreVectors)
    expect(snapshot.frontierIndices).toEqual(reference.frontierIndices)
    expect(Arr.flatMap(snapshot.parentWeights, (entry) => Arr.replicate(entry.candidateIndex, entry.weight)))
      .toEqual(reference.parentCatalogue)
  }))

it.effect("gepa-mutation-tie-001: the engine rejects a tied child and returns the seed", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Run)(
      (yield* fixture("gepa-mutation-tie-001", "upstream-execution")).payload
    )
    const seed = Arr.headNonEmpty(reference.candidates).qa
    const proposed = yield* Effect.fromOption(
      Arr.findFirst(Record.keys(reference.table), (instruction) => instruction !== seed)
    )
    const module = yield* Module.predict(
      "qa",
      yield* Signature.make("Task", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      qa: new ModuleParameters({ instructions: seed, demos: [], outputStrategy: "text" })
    })
    // The task model echoes the active instruction so the metric can index the upstream table.
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Effect.succeed(
        `[[ ## answer ## ]]\n${
          Bool.match(Str.includes(proposed)(prompt), { onFalse: () => seed, onTrue: () => proposed })
        }`
      )
    ))
    const calls = yield* Ref.make(Arr.empty<typeof Run.Type["calls"][number]>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const input = yield* Schema.decodeUnknownEffect(Schema.Struct({ question: Schema.String }))(example.input)
        const row = yield* Effect.fromOption(
          Arr.findFirst(reference.rows, (candidate) => candidate.id === input.question)
        )
        const answer = yield* Schema.decodeUnknownEffect(Schema.Struct({ answer: Schema.String }))(prediction.output)
        const score = yield* Effect.fromOption(
          Record.get(reference.table, answer.answer).pipe(Option.flatMap(Arr.get(row.index)))
        )
        yield* Ref.update(calls, Arr.append({ id: row.id, instruction: answer.answer, score })).pipe(
          Effect.when(Effect.succeed(Option.isNone(context.target)))
        )
        return new Metric.Score({ value: score, feedback: Option.some("fb") })
      })
    )
    const examples = Arr.map(reference.rows, (row) =>
      new Example({ id: Option.some(Id.make(row.id)), input: { question: row.id }, labels: Option.none() }))
    const events = yield* Ref.make(Arr.empty<GEPA.Event>())
    const result = yield* GEPA.runWithEvents(
      new GEPA.Options({
        module,
        metric,
        trainset: examples,
        valset: examples,
        seed: reference.seed,
        maxMetricCalls: reference.maxMetricCalls,
        reflectionMinibatchSize: 3,
        skipPerfectScore: false,
        useMerge: false,
        instructionProposer: (_, components) =>
          Effect.succeed(
            Record.fromEntries(Arr.map(Arr.fromIterable(components), (component) =>
              Tuple.make(component, proposed)))
          )
      }),
      (event) => Ref.update(events, Arr.append(event))
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(yield* Ref.get(calls)).toEqual(reference.calls)
    expect(
      Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
        Match.value(event).pipe(
          Match.tag("AcceptanceEvaluated", (acceptance) =>
            Option.some({
              accepted: acceptance.accepted,
              beforeSum: acceptance.previousSubsampleSum,
              afterSum: acceptance.mutatedSubsampleSum
            })),
          Match.orElse(() => Option.none())
        )))
    ).toEqual(Arr.map(reference.rejected, (rejected) => ({ accepted: false, ...rejected })))
    expect(Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
      Match.value(event).pipe(
        Match.tag("IterationCompleted", (completed) => Option.some(completed.acceptedCandidate)),
        Match.orElse(() => Option.none())
      )))).toEqual(Arr.map(reference.iterations, (iteration) => iteration.accepted))
    expect(Option.getOrThrow(Record.get(result.parameters, "qa")).instructions).toBe(
      Option.getOrThrow(Arr.get(reference.candidates, reference.bestIndex)).qa
    )
  }))

const MergeRow = Schema.Struct({ id: Schema.String, split: Schema.String, index: Schema.Int })
const Instructions = Schema.Record(Schema.String, Schema.String)
const MergeRun = Schema.Struct({
  seed: Schema.Int,
  maxMetricCalls: Schema.Int,
  train: Schema.Array(MergeRow),
  val: Schema.Array(MergeRow),
  validationScores: Schema.Record(Schema.String, Vector),
  calls: Schema.Array(Schema.Struct({ id: Schema.String, candidate: Instructions, score: Schema.Finite })),
  merges: Schema.Array(Schema.Struct({ iteration: Schema.Int, parents: Schema.Array(Schema.Int) })),
  acceptedMerges: Schema.Array(Schema.Int),
  iterations: Schema.Array(Schema.Struct({ iteration: Schema.Int, accepted: Schema.Boolean, metricCalls: Schema.Int })),
  candidates: Schema.Array(Instructions),
  scoreVectors: Schema.Array(Vector),
  bestIndex: Schema.Int,
  totalMetricCalls: Schema.Int
})

it.effect("gepa-merge-tie-001: the engine accepts a merge whose subsample sum ties the best parent", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(MergeRun)(
      (yield* fixture("gepa-merge-tie-001", "upstream-execution")).payload
    )
    const signature = yield* Signature.make("Task", { question: Schema.String }, { answer: Schema.String })
    const qa = yield* Module.predict("qa", signature)
    const judge = yield* Module.predict("judge", signature)
    const module = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature: yield* Signature.make("Task", MergeRow.fields, { qa: Schema.String, judge: Schema.String }),
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
    // Each predictor answers with its active instruction, so the metric can index the upstream vectors.
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.fromFunction((prompt) =>
        Effect.sync(() =>
          `[[ ## answer ## ]]\n${
            Option.getOrThrow(Str.match(/Instructions: (seed|left|right)/)(prompt).pipe(Option.flatMap(Arr.get(1))))
          }`
        )
      )
    )
    const calls = yield* Ref.make(Arr.empty<typeof MergeRun.Type["calls"][number]>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const row = yield* Schema.decodeUnknownEffect(MergeRow)(example.input)
        const output = yield* Schema.decodeUnknownEffect(Schema.Struct({ qa: Schema.String, judge: Schema.String }))(
          prediction.output
        )
        const candidate = { "root.draft": output.qa, "root.judge": output.judge }
        const score = yield* Bool.match(row.split === "train", {
          onTrue: () =>
            Effect.succeed(
              0.2 + 0.2 * Arr.filter([output.qa, output.judge], (instruction) => instruction !== "seed").length
            ),
          onFalse: () =>
            Effect.fromOption(
              Record.get(reference.validationScores, `${output.qa}/${output.judge}`).pipe(
                Option.flatMap(Arr.get(row.index))
              )
            )
        })
        yield* Ref.update(calls, Arr.append({ id: row.id, candidate, score })).pipe(
          Effect.when(Effect.succeed(Option.isNone(context.target)))
        )
        return new Metric.Score({ value: score, feedback: Option.some("improve") })
      })
    )
    const examples = (rows: ReadonlyArray<typeof MergeRow.Type>) =>
      Arr.map(rows, (row) => new Example({ id: Option.some(Id.make(row.id)), input: row, labels: Option.none() }))
    const options = new GEPA.Options({
      module,
      metric,
      trainset: examples(reference.train),
      valset: examples(reference.val),
      seed: reference.seed,
      maxMetricCalls: reference.maxMetricCalls,
      skipPerfectScore: false,
      instructionProposer: (_, components) =>
        Effect.succeed(Record.fromEntries(Arr.map(Arr.fromIterable(components), (component) =>
          Tuple.make(
            component,
            Bool.match(component === "root.draft", { onFalse: () => "right", onTrue: () => "left" })
          ))))
    })
    const result = yield* assertNoMutation(module, GEPA.run(options)).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service)
    )
    const state = Option.getOrThrow(result.report.state)
    expect(yield* Ref.get(calls)).toEqual(reference.calls)
    expect(state.acceptedMerges).toBe(reference.acceptedMerges.length)
    expect(
      Arr.map(state.candidates, (candidate) =>
        Record.fromEntries(
          Arr.map(candidate.predictorInstructions, (entry) => Tuple.make(entry.predictorName, entry.instruction))
        ))
    ).toEqual(reference.candidates)
    expect(state.scoreVectors).toEqual(reference.scoreVectors)
    expect(result.report.metricCalls).toBe(reference.totalMetricCalls)
    expect(result.report.optimizationBestCandidateId).toBe(`candidate-${reference.bestIndex}`)
  }))
