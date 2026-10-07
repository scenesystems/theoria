import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import {
  Array as Arr,
  Boolean,
  Effect,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  String as Str,
  Struct
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { Example, Id } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as OptimizerEvent from "../../src/OptimizerEvent.js"
import * as Payload from "../../src/Payload.js"
import * as Signature from "../../src/Signature.js"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
const Call = Schema.Struct({
  id: Schema.String,
  answer: Schema.String,
  score: Schema.Finite,
  target: Schema.OptionFromNullOr(Schema.String)
})
const Reference = Schema.Struct({
  seed: Schema.Int,
  splits: Schema.Struct({ train: Schema.Array(Row), val: Schema.Array(Row) }),
  maxMetricCalls: Schema.Int,
  totalMetricCalls: Schema.Int,
  feedbackMetricCalls: Schema.Int,
  metricCalls: Schema.Array(Call),
  aggregateScores: Schema.Array(Schema.Finite),
  candidates: Schema.Array(Schema.Struct({ signature: Schema.Struct({ instructions: Schema.String }) })),
  state: Schema.Struct({ signature: Schema.Struct({ instructions: Schema.String }) })
})
const rows = (input: ReadonlyArray<typeof Row.Type>) =>
  Arr.map(
    input,
    (row) =>
      new Example({
        id: Option.some(Id.make(row.id)),
        input: { question: row.question },
        labels: Option.some({ answer: row.answer })
      })
  )

const prepare = (reference: typeof Reference.Type, perfect: boolean) =>
  Effect.gen(function*() {
    const module = yield* Module.predict(
      "self",
      yield* Signature.make("quality=0", { question: Schema.String }, { answer: Schema.String })
    )
    yield* Module.install(module, {
      self: new ModuleParameters({ instructions: "quality=0", demos: [], outputStrategy: "text" })
    })
    const proposals = yield* Ref.make(0)
    const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
      Boolean.match(Str.includes("Provide the new instructions")(prompt), {
        onTrue: () =>
          Ref.updateAndGet(proposals, Num.increment).pipe(Effect.map((level) => `\`\`\`quality=${level}\`\`\``)),
        onFalse: () =>
          Effect.succeed(
            `[[ ## answer ## ]]\n${
              Option.getOrThrow(
                Str.match(/Instructions: quality=(\d+)/)(prompt).pipe(Option.flatMap((match) => Arr.get(match, 1)))
              )
            }\n[[ ## completed ## ]]`
          )
      })
    ))
    const calls = yield* Ref.make(Arr.empty<typeof Call.Type>())
    const metric = Metric.withFeedback((example, prediction, context) =>
      Effect.gen(function*() {
        const output = yield* Schema.decodeUnknownEffect(Schema.Struct({ answer: Schema.String }))(prediction.output)
        const level = yield* Schema.decodeEffect(Schema.FiniteFromString)(output.answer)
        const score = Boolean.match(perfect, {
          onFalse: () =>
            Option.getOrThrow(Arr.get([0.2, 0.4, 0.6, 0.8], level)),
          onTrue: () => 1
        })
        const id = Option.getOrThrow(example.id)
        yield* Option.match(context.target, {
          onNone: () => Effect.void,
          onSome: () =>
            Effect.sync(() => {
              expect(context.phase).toBe("reflect")
              expect(Arr.some(Arr.fromIterable(Option.getOrThrow(context.trace).selected), (entry) =>
                entry.execution === Option.getOrThrow(context.target).execution)).toBe(true)
            })
        })
        yield* Ref.update(
          calls,
          Arr.append({
            id,
            answer: output.answer,
            score,
            target: Option.map(context.target, () =>
              "self")
          })
        )
        return new Metric.Score({ value: score, feedback: Option.some(`feedback:${id}:${score}`) })
      })
    )
    const options = new GEPA.Options({
      module,
      trainset: rows(reference.splits.train),
      valset: rows(reference.splits.val),
      metric,
      maxMetricCalls: reference.maxMetricCalls,
      useMerge: false,
      seed: reference.seed
    })
    return { options, mock, calls }
  })

Arr.forEach(["gepa-001", "gepa-budget-001"], (id) => {
  it.effect(`${id}: exact metric identities, feedback accounting, overshoot and selected instructions`, () =>
    Effect.gen(function*() {
      const reference = yield* Schema.decodeUnknownEffect(Reference)((yield* fixture(id, "upstream-execution")).payload)
      const { options, mock, calls } = yield* prepare(reference, id === "gepa-budget-001")
      const result = yield* assertNoMutation(options.module, GEPA.run(options)).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        ModelBinder.withBinder(mock.binder)
      )
      expect(yield* Ref.get(calls)).toEqual(reference.metricCalls)
      expect(result.report.metricCalls).toBe(reference.totalMetricCalls)
      expect(result.report.feedbackMetricCalls).toBe(reference.feedbackMetricCalls)
      expect(result.report.metricCalls).toBeGreaterThan(reference.maxMetricCalls)
      const state = Option.getOrThrow(result.report.state)
      expect(
        Arr.map(
          state.candidates,
          (candidate) => Option.getOrThrow(Arr.head(candidate.predictorInstructions)).instruction
        )
      ).toEqual(Arr.map(reference.candidates, (candidate) => candidate.signature.instructions))
      expect(Option.getOrThrow(Record.get(result.parameters, "self")).instructions).toBe(
        reference.state.signature.instructions
      )
      const critic = Arr.filter(yield* Ref.get(mock.calls), (call) => call.role === "critic")
      expect(critic).toHaveLength(Boolean.match(id === "gepa-budget-001", { onFalse: () => 3, onTrue: () => 0 }))
      Arr.forEach(critic, (call) => {
        expect(call.prompt).not.toContain("val-")
        expect(call.prompt).toContain("feedback:train-")
      })
    }))
})

it.effect("resuming a JSON checkpoint preserves candidates, scores, budget and both random streams", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-001", "upstream-execution")).payload
    )
    const uninterrupted = yield* prepare(reference, false)
    const full = yield* GEPA.run(uninterrupted.options).pipe(
      Effect.provideService(LanguageModel.LanguageModel, uninterrupted.mock.service)
    )
    const resumed = yield* prepare(reference, false)
    const first = yield* GEPA.run(new GEPA.Options(Struct.assign(resumed.options, { maxIterations: 1 }))).pipe(
      Effect.provideService(LanguageModel.LanguageModel, resumed.mock.service)
    )
    const json = yield* Schema.encodeEffect(Schema.fromJsonString(GEPA.State))(
      Option.getOrThrow(first.report.state)
    )
    const state = yield* Schema.decodeEffect(Schema.fromJsonString(GEPA.State))(json)
    const event = GEPA.events.Checkpoint({ state })
    const eventCodec = Schema.fromJsonString(GEPA.Event)
    expect(yield* Schema.decodeEffect(eventCodec)(yield* Schema.encodeEffect(eventCodec)(event))).toEqual(event)
    const envelope = yield* OptimizerEvent.fromGEPA(event)
    expect(yield* Payload.decode(GEPA.Event, envelope.payload)).toEqual(event)
    const rest = yield* GEPA.resume(resumed.options, state).pipe(
      Effect.provideService(LanguageModel.LanguageModel, resumed.mock.service)
    )
    expect(rest.report.state).toEqual(full.report.state)
    expect(rest.parameters).toEqual(full.parameters)
    expect(yield* Ref.get(resumed.calls)).toEqual(yield* Ref.get(uninterrupted.calls))
  }))

it.effect("reflection settings bind only critic calls, retaining task configuration", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Reference)(
      (yield* fixture("gepa-001", "upstream-execution")).payload
    )
    const { options, mock } = yield* prepare(reference, false)
    yield* GEPA.run(
      new GEPA.Options(Struct.assign(options, {
        maxIterations: 1,
        reflectionSettings: new ModelSettings({ temperature: 0.73, maxTokens: 123 })
      }))
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), ModelBinder.withBinder(mock.binder))
    const calls = yield* Ref.get(mock.calls)
    const critic = Arr.filter(calls, (call) => call.role === "critic")
    expect(critic).toHaveLength(1)
    expect(Option.getOrThrow(Arr.head(critic)).settings).toEqual(
      new ModelSettings({ temperature: 0.73, maxTokens: 123 })
    )
    Arr.forEach(Arr.filter(calls, (call) => call.role === "task"), (call) => {
      expect(call.settings.temperature).not.toBe(0.73)
      expect(call.settings.maxTokens).not.toBe(123)
    })
  }))
