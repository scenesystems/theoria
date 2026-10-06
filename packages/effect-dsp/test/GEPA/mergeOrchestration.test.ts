import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Record, Ref, Schema, String, Struct, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example, Id } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import type { ProgramCandidate } from "../../src/internal/gepa/model.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Predictor from "../../src/Predictor.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Row = Schema.Struct({ id: Schema.String, split: Schema.String, index: Schema.Int })
const Instructions = Schema.Record(Schema.String, Schema.String)
const Call = Schema.Struct({ id: Schema.String, candidate: Instructions, score: Schema.Finite })
const Proposal = Schema.Struct({
  candidate: Instructions,
  components: Schema.Array(Schema.String),
  proposed: Instructions
})
const Reference = Schema.Struct({
  seed: Schema.Int,
  maxMetricCalls: Schema.Int,
  acceptMerge: Schema.Boolean,
  train: Schema.Array(Row),
  val: Schema.Array(Row),
  validationScores: Schema.Record(Schema.String, Schema.Array(Schema.Finite)),
  calls: Schema.Array(Call),
  proposals: Schema.Array(Proposal),
  iterations: Schema.Array(Schema.Struct({ iteration: Schema.Int, accepted: Schema.Boolean, metricCalls: Schema.Int })),
  candidates: Schema.Array(Instructions),
  parents: Schema.Array(Schema.Array(Schema.OptionFromNullOr(Schema.Int))),
  scoreVectors: Schema.Array(Schema.Array(Schema.Finite)),
  bestIndex: Schema.Int,
  totalMetricCalls: Schema.Int
})
const instructions = (candidate: ProgramCandidate) =>
  Record.fromEntries(
    Arr.map(candidate.predictorInstructions, (entry) => Tuple.make(entry.predictorName, entry.instruction))
  )
const examples = (rows: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(rows, (row) => new Example({ id: Option.some(Id.make(row.id)), input: row, labels: Option.none() }))
const prepare = (reference: typeof Reference.Type) =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("Task", { question: Schema.String }, { answer: Schema.String })
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
            String.match(/Instructions: (seed|left|right)/)(prompt).pipe(Option.flatMap((match) => Arr.get(match, 1)))
          )
        }`
      )
    ))
    const calls = yield* Ref.make(Arr.empty<typeof Call.Type>())
    const proposals = yield* Ref.make(Arr.empty<typeof Proposal.Type>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const row = yield* Schema.decodeUnknownEffect(Row)(example.input)
        const output = yield* Schema.decodeUnknownEffect(Schema.Struct({ qa: Schema.String, judge: Schema.String }))(
          prediction.output
        )
        const candidate = { "root.draft": output.qa, "root.judge": output.judge }
        const score = row.split === "train" ?
          0.2 + 0.2 * Arr.filter([output.qa, output.judge], (instruction) => instruction !== "seed").length
          : Option.getOrThrow(
            Arr.get(
              Option.getOrThrow(Record.get(reference.validationScores, `${output.qa}/${output.judge}`)),
              row.index
            )
          )
        if (Option.isNone(context.target)) yield* Ref.update(calls, Arr.append({ id: row.id, candidate, score }))
        return new Metric.Score({ value: score, feedback: Option.some("improve") })
      })
    )
    const options = new GEPA.Options({
      module,
      metric,
      trainset: examples(reference.train),
      valset: examples(reference.val),
      seed: reference.seed,
      maxMetricCalls: reference.maxMetricCalls,
      skipPerfectScore: false,
      instructionProposer: (candidate, components) =>
        Effect.gen(function*() {
          const proposed = Record.fromEntries(
            Arr.map(
              Arr.fromIterable(components),
              (component) => Tuple.make(component, component === "root.draft" ? "left" : "right")
            )
          )
          yield* Ref.update(
            proposals,
            Arr.append({ candidate: instructions(candidate), components: Arr.fromIterable(components), proposed })
          )
          return proposed
        })
    })
    return { options, mock, calls, proposals }
  })

Arr.forEach(["gepa-merge-accepted-001", "gepa-merge-rejected-001"], (id) => {
  it.effect(`${id}: exact engine trace, aggregate selection and resume through the merge boundary`, () =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Reference)((yield* fixture(id, "upstream-execution")).payload)
      const full = yield* prepare(reference)
      const events = yield* Ref.make(Arr.empty<GEPA.Event>())
      const result = yield* assertNoMutation(
        full.options.module,
        GEPA.runWithEvents(full.options, (event) => Ref.update(events, Arr.append(event)))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, full.mock.service))
      const state = Option.getOrThrow(result.report.state)
      expect(yield* Ref.get(full.calls)).toEqual(reference.calls)
      expect(yield* Ref.get(full.proposals)).toEqual(reference.proposals)
      expect(Arr.map(state.candidates, instructions)).toEqual(reference.candidates)
      expect(
        Arr.map(
          state.candidates,
          (candidate) =>
            Arr.map(
              candidate.parentIds,
              (parent) =>
                Option.getOrThrow(Arr.findFirstIndex(state.candidates, (candidate) => candidate.candidateId === parent))
            )
        )
      ).toEqual(Arr.map(reference.parents, Arr.getSomes))
      expect(state.scoreVectors).toEqual(reference.scoreVectors)
      expect(result.report.metricCalls).toBe(reference.totalMetricCalls)
      expect(result.report.feedbackMetricCalls).toBe(6)
      expect(result.report.optimizationBestCandidateId).toBe(`candidate-${reference.bestIndex}`)
      expect(Record.map(result.parameters, (parameters) => parameters.instructions)).toEqual(
        Option.getOrThrow(Arr.get(reference.candidates, reference.bestIndex))
      )
      expect(
        Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
          event._tag === "Checkpoint" && event.state.iteration > 0
            ? Option.some({ iteration: event.state.iteration, metricCalls: event.state.metricCalls }) :
            Option.none()))
      ).toEqual(Arr.map(reference.iterations, Struct.pick(["iteration", "metricCalls"])))
      expect(Arr.getSomes(Arr.map(yield* Ref.get(events), (event) =>
        event._tag === "IterationCompleted"
          ? Option.some(event.acceptedCandidate) :
          Option.none()))).toEqual(Arr.map(reference.iterations, (iteration) => iteration.accepted))
      expect(state.mergeTriplets).toEqual([[1, 2, 0]])
      expect(state.mergeDescriptions).toEqual([[1, 2, [1, 2]]])
      expect(state.acceptedMerges).toBe(reference.acceptMerge ? 1 : 0)
      expect(state.mergesDue).toBe(reference.acceptMerge ? 1 : 2)
      expect(state.componentCursors).toEqual(reference.acceptMerge ? [0, 1, 0, 1] : [0, 1, 0])

      const partial = yield* prepare(reference)
      const first = yield* GEPA.run(new GEPA.Options(Struct.assign(partial.options, { maxIterations: 2 }))).pipe(
        Effect.provideService(LanguageModel.LanguageModel, partial.mock.service)
      )
      const codec = Schema.fromJsonString(GEPA.Report)
      const restored = yield* Schema.decodeEffect(codec)(yield* Schema.encodeEffect(codec)(first.report))
      const continued = yield* GEPA.resume(partial.options, Option.getOrThrow(restored.state)).pipe(
        Effect.provideService(LanguageModel.LanguageModel, partial.mock.service)
      )
      expect(continued.report.state).toEqual(result.report.state)
      expect(continued.parameters).toEqual(result.parameters)
      expect(yield* Ref.get(partial.calls)).toEqual(reference.calls)
      expect(yield* Ref.get(partial.proposals)).toEqual(reference.proposals)
    }))
})

it.effect("all and custom component selection scope feedback and updates to the selected paths", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-merge-accepted-001", "upstream-execution")).payload
    )
    yield* Effect.forEach([true, false], (all) =>
      Effect.gen(function*() {
        const { options, mock, proposals } = yield* prepare(reference)
        const selector = (_: GEPA.State) => Chunk.of(Predictor.Path.make("root.judge"))
        const componentSelector: "all" | typeof selector = all ? "all" : selector
        const result = yield* GEPA.run(
          new GEPA.Options(Struct.assign(options, {
            maxIterations: 1,
            componentSelector
          }))
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
        const observed = Option.getOrThrow(Arr.head(yield* Ref.get(proposals)))
        expect(observed.components).toEqual(all ? ["root.draft", "root.judge"] : ["root.judge"])
        expect(result.report.feedbackMetricCalls).toBe(all ? 6 : 3)
        expect(Record.map(result.parameters, (parameters) => parameters.instructions)).toEqual({
          "root.draft": all ? "left" : "seed",
          "root.judge": "right"
        })
      }))
  }))
