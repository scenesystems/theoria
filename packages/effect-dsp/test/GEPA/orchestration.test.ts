import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Data, Deferred, Effect, Fiber, Option, Record, Ref, Schema, Struct } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { GEPAError } from "../../src/DspError.js"
import { Example } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import { evaluateCandidate } from "../../src/internal/gepa/runtime/evaluate.js"
import { bestIndex } from "../../src/internal/gepa/runtime/mutation.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"
import { assertNoMutation } from "../kit/Mutation.js"

class MetricFailure extends Data.TaggedError("MetricFailure") {}
const examples = [new Example({ input: { question: "root-input" }, labels: Option.some({ answer: "correct" }) })]
const makeModule = Effect.gen(function*() {
  const child = yield* Module.predict(
    "child",
    yield* Signature.make("Draft", { query: Schema.String }, { answer: Schema.String }),
    new Module.PredictOptions({
      policy: new Module.PredictPolicyOverrides({ parse: new Module.ParsePolicyOverrides({ maxRetries: 0 }) })
    })
  )
  yield* Module.install(child, {
    child: new ModuleParameters({ instructions: "draft", demos: [], outputStrategy: "text" })
  })
  const root = yield* Module.compose(
    new Module.ComposeOptions({
      name: "root",
      signature: yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String }),
      subModules: { child },
      forward: ({ input }) => child.forward({ query: `child:${input.question}` })
    })
  )
  const candidate = new GEPA.ProgramCandidate({
    candidateId: "candidate",
    parentIds: [],
    predictorInstructions: [
      new GEPA.PredictorInstruction({ predictorName: "root.child", instruction: "changed child" })
    ]
  })
  return { root, child, candidate }
})

it.effect("failed scoring receives failureScore without writing composed parameters", () =>
  Effect.gen(function*() {
    const { root, child, candidate } = yield* makeModule
    const before = yield* Ref.get(child.parameters)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\ncorrect"))
    const options = new GEPA.Options({
      module: root,
      trainset: examples,
      metric: Metric.withFeedback(() => Effect.fail(new MetricFailure())),
      maxMetricCalls: 1,
      failureScore: -0.75
    })
    const evaluation = yield* assertNoMutation(root, evaluateCandidate(options, candidate, examples, "select")).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service)
    )
    expect(evaluation.scores).toEqual([-0.75])
    expect(Option.isSome(Option.getOrThrow(Arr.head(evaluation.rows)).failure)).toBe(true)
    expect(Option.getOrThrow(Arr.head(yield* Ref.get(mock.calls))).prompt).toContain("changed child")
    expect(yield* Ref.get(child.parameters)).toEqual(before)
  }))

it.effect("interruption remains interruption and preserves composed parameters", () =>
  Effect.gen(function*() {
    const { root, child, candidate } = yield* makeModule
    const before = yield* Ref.get(child.parameters)
    const started = yield* Deferred.make<void>()
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\ncorrect"))
    const options = new GEPA.Options({
      module: root,
      trainset: examples,
      metric: Metric.withFeedback(() => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never))),
      maxMetricCalls: 1
    })
    const fiber = yield* evaluateCandidate(options, candidate, examples, "select").pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service),
      Effect.forkScoped
    )
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    expect(yield* Ref.get(child.parameters)).toEqual(before)
  }))

it.effect("format-failure reflection retains actual child input/raw output, skips feedback calls and RNG choice", () =>
  Effect.gen(function*() {
    const { root } = yield* makeModule
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("not a marked answer"))
    const observed = yield* Ref.make(Arr.empty<string>())
    const metricCalls = yield* Ref.make(0)
    const options = new GEPA.Options({
      module: root,
      trainset: examples,
      maxMetricCalls: 2,
      useMerge: false,
      addFormatFailureAsFeedback: true,
      metric: Metric.withFeedback(() =>
        Ref.update(metricCalls, (n) => n + 1).pipe(Effect.as(new Metric.Score({ value: 0, feedback: Option.none() })))
      ),
      instructionProposer: (_, components, samples) =>
        Effect.gen(function*() {
          expect(components).toEqual(Chunk.of("root.child"))
          const rows = Option.getOrThrow(Record.get(samples, "root.child"))
          expect(rows).toHaveLength(3)
          Arr.forEach(rows, (row) => {
            expect(Schema.decodeSync(Schema.fromJsonString(Schema.Struct({ query: Schema.String })))(row.inputs))
              .toEqual({ query: "child:root-input" })
            expect(row.generatedOutputs).toContain("not a marked answer")
            expect(row.feedback).toContain("Your output failed to parse")
            expect(row.feedback).toContain("[[ ## answer ## ]]")
          })
          yield* Ref.update(observed, Arr.append("proposed"))
          return { "root.child": "improved" }
        })
    })
    const result = yield* assertNoMutation(root, GEPA.run(options)).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service)
    )
    expect(yield* Ref.get(observed)).toEqual(["proposed"])
    expect(yield* Ref.get(metricCalls)).toBe(0)
    expect(result.report.metricCalls).toBe(7)
    expect(result.report.feedbackMetricCalls).toBe(0)
    const state = Option.getOrThrow(result.report.state)
    const baseline = yield* GEPA.run(new GEPA.Options(Struct.assign(options, { maxIterations: 0 }))).pipe(
      Effect.provideService(LanguageModel.LanguageModel, mock.service)
    )
    expect(state.adapterRandom).toEqual(Option.getOrThrow(baseline.report.state).adapterRandom)
    const disabled = yield* GEPA.run(new GEPA.Options(Struct.assign(options, { addFormatFailureAsFeedback: false })))
      .pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
    expect(disabled.report.metricCalls).toBe(4)
    expect(yield* Ref.get(observed)).toHaveLength(1)
  }))

it.effect("rejects ambiguous budgets and empty/overlapping datasets before model calls", () =>
  Effect.gen(function*() {
    const { root } = yield* makeModule
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("unused"))
    const base = { module: root, trainset: examples, metric: Metric.exactMatch("answer") }
    yield* Effect.forEach([
      new GEPA.Options(base),
      new GEPA.Options({ ...base, maxMetricCalls: 5, maxFullEvals: 1 }),
      new GEPA.Options({ ...base, maxMetricCalls: 5, trainset: [] }),
      new GEPA.Options({ ...base, maxMetricCalls: 5, requireDistinctValset: true })
    ], (options) =>
      Effect.gen(function*() {
        expect(yield* GEPA.run(options).pipe(Effect.flip)).toBeInstanceOf(GEPAError)
      })).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(yield* Ref.get(mock.calls)).toHaveLength(0)
  }))

it.effect("an empty valset falls back to training; best aggregate keeps the earliest exact tie", () =>
  Effect.gen(function*() {
    const { root } = yield* makeModule
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\ncorrect"))
    const options = new GEPA.Options({
      module: root,
      trainset: examples,
      valset: [],
      metric: Metric.exactMatch("answer"),
      maxFullEvals: 1
    })
    const result = yield* GEPA.run(options).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(result.report.metricCalls).toBe(1)
    expect(result.report.optimizationIterationCount).toBe(0)
    expect(bestIndex([[1, 0], [0.8, 0.8], [0.9, 0.7]])).toBe(1)
  }))

it.effect("feedback chooses actual repeated predictor executions on the independent seed-0 adapter stream", () =>
  Effect.gen(function*() {
    const { child } = yield* makeModule
    const root = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature: yield* Signature.make("Repeat", { question: Schema.String }, { answer: Schema.String }),
        subModules: { child },
        forward: () =>
          Effect.gen(function*() {
            yield* child.forward({ query: "first" })
            return yield* child.forward({ query: "second" })
          })
      })
    )
    const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\ncorrect"))
    const targets = yield* Ref.make(Arr.empty<string>())
    const result = yield* GEPA.run(
      new GEPA.Options({
        module: root,
        trainset: examples,
        maxMetricCalls: 2,
        useMerge: false,
        metric: Metric.withFeedback((_, prediction, context) =>
          Effect.gen(function*() {
            yield* Option.match(context.target, {
              onNone: () => Effect.void,
              onSome: (target) =>
                Effect.gen(function*() {
                  expect(target.predictorId).toBe("root.child")
                  const entry = Option.getOrThrow(
                    Chunk.findFirst(prediction.trace.selected, (entry) => entry.execution === target.execution)
                  )
                  const input = yield* Schema.decodeEffect(
                    Schema.fromJsonString(Schema.Struct({ query: Schema.String }))
                  )(
                    entry.input
                  )
                  yield* Ref.update(targets, Arr.append(input.query))
                })
            })
            return new Metric.Score({ value: 0.25, feedback: Option.none() })
          })
        ),
        instructionProposer: (_, __, samples) =>
          Effect.gen(function*() {
            const rows = Option.getOrThrow(Record.get(samples, "root.child"))
            expect(Arr.map(rows, (row) => row.feedback)).toEqual(
              Arr.replicate("This trajectory got a score of 0.25.", 3)
            )
            expect(
              Arr.map(rows, (row) =>
                Schema.decodeSync(Schema.fromJsonString(Schema.Struct({ query: Schema.String })))(row.inputs).query)
            ).toEqual(["second", "second", "first"])
            return { "root.child": "improved" }
          })
      })
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
    expect(yield* Ref.get(targets)).toEqual(["second", "second", "first"])
    expect(result.report.feedbackMetricCalls).toBe(3)
    expect(result.report.metricCalls).toBe(7)
  }))
