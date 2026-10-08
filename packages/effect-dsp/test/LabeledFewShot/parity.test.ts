import { expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as LabeledFewShot from "@scenesystems/effect-dsp/LabeledFewShot"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { withDemos } from "@scenesystems/effect-dsp/ModuleParameters"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { fixture } from "../kit/Fixtures.js"
import { assertNoMutation } from "../kit/Mutation.js"

it.effect("labeledfewshot-001: resets demos, samples in canonical path order despite declaration order, and takes prefixes", () =>
  Effect.gen(function*() {
    const Row = Schema.Struct({ id: Schema.String, question: Schema.String, answer: Schema.String })
    const reference = yield* Schema.decodeUnknownEffect(Schema.Struct({
      splits: Schema.Struct({ train: Schema.Array(Row) }),
      state: Schema.Struct({ demos: Schema.Array(Row) }),
      predictors: Schema.Struct({
        first: Schema.Struct({ demos: Schema.Array(Row) }),
        second: Schema.Struct({ demos: Schema.Array(Row) })
      })
    }))((yield* fixture("labeledfewshot-001", "upstream-execution")).payload)
    const signature = yield* Signature.make("answer", { question: Schema.String }, { answer: Schema.String })
    const a = yield* Module.predict("a", signature)
    const b = yield* Module.predict("b", signature)
    const root = yield* Module.compose(
      new Module.ComposeOptions({
        name: "root",
        signature,
        subModules: { b, a },
        forward: ({ input }) => a.forward(input)
      })
    )
    const module = Module.bound(
      root,
      Record.map(
        yield* ParameterSet.snapshot(root),
        (parameters) =>
          withDemos(parameters, [new Demonstration({ input: { question: "stale" }, output: { answer: "stale" } })])
      )
    )
    const trainset = Arr.map(
      reference.splits.train,
      (row) =>
        new Example({
          id: Option.some(Id.make(row.id)),
          input: { question: row.question },
          labels: Option.some({ answer: row.answer })
        })
    )
    const k = reference.state.demos.length
    const result = yield* assertNoMutation(
      module,
      LabeledFewShot.run(new LabeledFewShot.Options({ module, trainset, k }))
    )
    const first = Option.getOrThrow(Record.get(result.parameters, "root.a")).demos
    const second = Option.getOrThrow(Record.get(result.parameters, "root.b")).demos
    expect(Arr.map(first, (demo) => ({ question: demo.input.question, answer: demo.output.answer })))
      .toEqual(Arr.map(reference.predictors.first.demos, ({ question, answer }) => ({ question, answer })))
    expect(Arr.map(second, (demo) => ({ question: demo.input.question, answer: demo.output.answer })))
      .toEqual(Arr.map(reference.predictors.second.demos, ({ question, answer }) => ({ question, answer })))
    expect(first).not.toEqual(second)
    expect(Arr.some(first, (demo) => demo.input.question === "stale")).toBe(false)
    const prefix = yield* LabeledFewShot.run(new LabeledFewShot.Options({ module, trainset, k, sample: false }))
    expect(Arr.map(Option.getOrThrow(Record.get(prefix.parameters, "root.a")).demos, (demo) => demo.input.question))
      .toEqual(Arr.map(Arr.take(trainset, k), (row) => row.input.question))
  }))

it.effect("retains and renders incomplete labeled outputs without fabricating missing fields", () =>
  Effect.gen(function*() {
    const signature = yield* Signature.make("reason", { question: Schema.String }, {
      reasoning: Schema.String,
      answer: Schema.String
    })
    const module = yield* Module.predict("qa", signature)
    const result = yield* LabeledFewShot.run(
      new LabeledFewShot.Options({
        module,
        trainset: [
          new Example({ input: { question: "demo" }, labels: Option.some({ answer: "known", extra: "not-a-field" }) })
        ],
        sample: false
      })
    )
    const demos = Option.getOrThrow(Record.get(result.parameters, "qa")).demos
    expect(demos).toHaveLength(1)
    expect(Option.getOrThrow(Arr.head(demos)).incomplete).toBe(true)
    expect(Option.getOrThrow(Arr.head(demos)).output).toEqual({ answer: "known" })
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.succeed("[[ ## reasoning ## ]]\nwhy\n[[ ## answer ## ]]\nnew")
    )
    expect(
      yield* result.program.forward({ question: "next" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
    ).toEqual({ reasoning: "why", answer: "new" })
    expect(Option.getOrThrow(Arr.head(yield* Ref.get(mock.calls))).prompt).toContain("known")
  }))
