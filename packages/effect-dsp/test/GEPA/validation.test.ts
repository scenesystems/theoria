import { expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Chunk, Effect, Option, Ref, Schema, Struct } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { GEPAError } from "../../src/DspError.js"
import { Example } from "../../src/Example.js"
import * as GEPA from "../../src/GEPA.js"
import * as Metric from "../../src/Metric.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Predictor from "../../src/Predictor.js"
import * as Signature from "../../src/Signature.js"

const example = (question: string) => new Example({ input: { question }, labels: Option.some({ answer: "expected" }) })
const trainset = [example("train-0"), example("train-1"), example("train-2")]
const valset = [example("val-0"), example("val-1")]

const prepare = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const draft = yield* Module.predict("draft", signature)
  const check = Module.freeze(yield* Module.predict("check", signature))
  const module = yield* Module.compose(
    new Module.ComposeOptions({
      name: "root",
      signature,
      subModules: { draft, check },
      forward: ({ input }) => draft.forward(input).pipe(Effect.andThen(check.forward(input)))
    })
  )
  yield* Module.install(module, {
    "root.draft": new ModuleParameters({ instructions: "draft", demos: [], outputStrategy: "text" }),
    "root.check": new ModuleParameters({ instructions: "check", demos: [], outputStrategy: "text" })
  })
  const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("[[ ## answer ## ]]\nanswer"))
  const scored = yield* Ref.make(0)
  const metric = Metric.withFeedback(() =>
    Ref.update(scored, (count) => count + 1).pipe(
      Effect.as(new Metric.Score({ value: 0.5, feedback: Option.some("be more specific") }))
    )
  )
  const options = new GEPA.Options({ module, trainset, valset, metric, maxMetricCalls: 40, seed: 7 })
  return { options, mock, scored }
})

const criticCalls = (mock: MockLanguageModel.Runtime) =>
  Ref.get(mock.calls).pipe(Effect.map(Arr.filter((call) => call.role === "critic")))

it.effect("custom component selectors reject unknown and frozen predictor paths with a typed configuration error", () =>
  Effect.forEach(["root.missing", "root.check"], (path) =>
    Effect.gen(function*() {
      const { options, mock } = yield* prepare
      const error = yield* GEPA.run(
        new GEPA.Options(Struct.assign(options, {
          maxIterations: 1,
          componentSelector: () => Chunk.of(Predictor.Path.make(path))
        }))
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        ModelBinder.withBinder(mock.binder),
        Effect.flip
      )
      expect(error).toBeInstanceOf(GEPAError)
      expect(error).toMatchObject({ reason: "invalid-options" })
      expect(error.message).toContain(path)
      expect(yield* criticCalls(mock)).toEqual([])
    }), { discard: true }))

it.effect("custom component selectors may still choose trainable paths of the selected parent", () =>
  Effect.gen(function*() {
    const { options, mock } = yield* prepare
    const result = yield* GEPA.run(
      new GEPA.Options(Struct.assign(options, {
        maxIterations: 1,
        componentSelector: () => Chunk.of(Predictor.Path.make("root.draft"))
      }))
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), ModelBinder.withBinder(mock.binder))
    expect(result.report.mutationProposedCount).toBe(1)
    expect(yield* criticCalls(mock)).toHaveLength(1)
  }))

const StateJson = GEPA.State
type Encoded = typeof GEPA.State.Encoded

const corruptions: ReadonlyArray<readonly [string, (state: Encoded) => Encoded]> = [
  ["a candidate names a predictor absent from the program", (state) =>
    Struct.assign(state, {
      candidates: Arr.map(state.candidates, (candidate) =>
        Struct.assign(candidate, {
          predictorInstructions: Arr.map(
            candidate.predictorInstructions,
            (entry) => Struct.assign(entry, { predictorName: "root.renamed" })
          )
        }))
    })],
  ["a candidate carries an instruction for a frozen predictor", (state) =>
    Struct.assign(state, {
      candidates: Arr.map(state.candidates, (candidate) =>
        Struct.assign(candidate, {
          predictorInstructions: Arr.append(candidate.predictorInstructions, {
            predictorName: "root.check",
            instruction: "check"
          })
        }))
    })],
  ["a candidate's parent is not an earlier candidate", (state) =>
    Struct.assign(state, {
      candidates: Arr.map(state.candidates, (candidate) => Struct.assign(candidate, { parentIds: ["candidate-0"] }))
    })],
  ["candidate identifiers repeat", (state) =>
    Struct.assign(state, {
      candidates: Arr.appendAll(state.candidates, state.candidates),
      scoreVectors: Arr.appendAll(state.scoreVectors, state.scoreVectors),
      componentCursors: Arr.appendAll(state.componentCursors, state.componentCursors)
    })],
  [
    "score vectors do not cover every candidate",
    (state) => Struct.assign(state, { scoreVectors: Arr.empty<ReadonlyArray<number>>() })
  ],
  [
    "a score vector does not cover the validation set",
    (state) => Struct.assign(state, { scoreVectors: Arr.map(state.scoreVectors, Arr.append(0.5)) })
  ],
  [
    "component cursors do not match the candidates",
    (state) => Struct.assign(state, { componentCursors: Arr.append(state.componentCursors, 0) })
  ],
  [
    "a round-robin cursor is outside the trainable predictors",
    (state) => Struct.assign(state, { componentCursors: Arr.map(state.componentCursors, () => 4) })
  ],
  ["the persisted frontier was not derived from the score vectors", (state) =>
    Struct.assign(state, {
      paretoSnapshot: Struct.assign(state.paretoSnapshot, {
        parentWeights: Arr.map(
          state.paretoSnapshot.parentWeights,
          (entry) => Struct.assign(entry, { candidateIndex: 7 })
        )
      })
    })],
  [
    "the minibatch schedule belongs to another training set",
    (state) => Struct.assign(state, { batch: Struct.assign(state.batch, { trainsetSize: 9, shuffled: [8, 7, 6] }) })
  ]
]

const checkpoint = Effect.gen(function*() {
  const { options, mock } = yield* prepare
  const first = yield* GEPA.run(new GEPA.Options(Struct.assign(options, { maxIterations: 1 }))).pipe(
    Effect.provideService(LanguageModel.LanguageModel, mock.service)
  )
  return Option.getOrThrow(first.report.state)
})

Arr.forEach(corruptions, ([description, corrupt]) => {
  it.effect(`resume rejects a checkpoint where ${description}`, () =>
    Effect.gen(function*() {
      const state = yield* Schema.decodeEffect(StateJson)(
        corrupt(yield* Schema.encodeEffect(StateJson)(yield* checkpoint))
      )
      const fresh = yield* prepare
      const error = yield* GEPA.resume(new GEPA.Options(Struct.assign(fresh.options, { maxIterations: 3 })), state)
        .pipe(
          Effect.provideService(LanguageModel.LanguageModel, fresh.mock.service),
          Effect.flip
        )
      expect(error).toBeInstanceOf(GEPAError)
      expect(error).toMatchObject({ reason: "invalid-state" })
      expect(yield* Ref.get(fresh.scored)).toBe(0)
      expect(yield* Ref.get(fresh.mock.calls)).toEqual([])
    }))
})

it.effect("resume rejects a checkpoint continued with a different validation set", () =>
  Effect.gen(function*() {
    const state = yield* checkpoint
    const fresh = yield* prepare
    const error = yield* GEPA.resume(
      new GEPA.Options(
        Struct.assign(fresh.options, { maxIterations: 3, valset: Arr.append(valset, example("val-2")) })
      ),
      state
    ).pipe(Effect.provideService(LanguageModel.LanguageModel, fresh.mock.service), Effect.flip)
    expect(error).toBeInstanceOf(GEPAError)
    expect(error).toMatchObject({ reason: "invalid-state" })
    expect(yield* Ref.get(fresh.scored)).toBe(0)
  }))

it.effect("a consistent checkpoint resumes after validation", () =>
  Effect.gen(function*() {
    const state = yield* Schema.decodeEffect(StateJson)(yield* Schema.encodeEffect(StateJson)(yield* checkpoint))
    const fresh = yield* prepare
    const resumed = yield* GEPA.resume(new GEPA.Options(Struct.assign(fresh.options, { maxIterations: 2 })), state)
      .pipe(Effect.provideService(LanguageModel.LanguageModel, fresh.mock.service))
    expect(Option.getOrThrow(resumed.report.state).iteration).toBe(2)
    expect(yield* Ref.get(fresh.scored)).toBeGreaterThan(0)
  }))
