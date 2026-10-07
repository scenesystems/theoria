import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Record, Ref, Schema, String as Str, Tuple } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { withInstructions } from "../../src/ModuleParameters.js"
import * as ParameterSet from "../../src/ParameterSet.js"
import * as Signature from "../../src/Signature.js"

describe("parameter overlays", () => {
  it.effect("isolates eight concurrent candidate instructions without writing caller refs", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const leaf = yield* Module.predict("generate", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa",
          signature,
          subModules: { generate: leaf },
          forward: ({ input }) => leaf.forward(input)
        })
      )
      const before = yield* ParameterSet.snapshot(root)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      const outputs = yield* Effect.forEach(Arr.range(0, 7), (index) => {
        const parameters = Record.map(before, (parameters) => withInstructions(parameters, `candidate-${index}`))
        return Module.bound(root, parameters).forward({ question: "q" })
      }, { concurrency: "unbounded" }).pipe(Effect.provideService(LanguageModel.LanguageModel, lm.service))
      yield* Effect.forEach(outputs, (output, index) =>
        Effect.sync(() => {
          expect(output.answer).toContain(`candidate-${index}`)
          expect(Arr.every(
            Arr.filter(Arr.range(0, 7), (other) => other !== index),
            (other) => !Str.includes(`candidate-${other}`)(output.answer)
          )).toBe(true)
        }))
      expect(yield* ParameterSet.snapshot(root)).toEqual(before)
      expect((yield* Ref.get(leaf.parameters)).instructions).toBe(signature.instructions)
    }))

  it.effect("preserves bound defaults when composed and lets root overlays win", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const leaf = yield* Module.predict("generate", signature)
      const defaults = Record.map(yield* ParameterSet.snapshot(leaf), (parameters) =>
        withInstructions(parameters, "bound-default"))
      const bound = Module.bound(leaf, defaults)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa",
          signature,
          subModules: { child: bound },
          forward: ({ input }) =>
            bound.forward(input)
        })
      )
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      expect(
        (yield* root.forward({ question: "q" }).pipe(Effect.provideService(LanguageModel.LanguageModel, lm.service)))
          .answer
      ).toContain("bound-default")
      const snapshot = yield* ParameterSet.snapshot(root)
      expect(Record.get(snapshot, "qa.child")).toEqual(Record.get(defaults, "generate"))
      const override = Record.map(snapshot, (parameters) => withInstructions(parameters, "explicit-override"))
      const output = yield* root.forward({ question: "q" }).pipe(
        Module.withParameters(override),
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(output.answer).toContain("explicit-override")
      expect(output.answer).not.toContain("bound-default")
      expect((yield* Ref.get(leaf.parameters)).instructions).toBe(signature.instructions)
    }))
})

const makeSharedFixture = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const leaf = yield* Module.predict("generate", signature)
  const withDefault = (instructions: string) =>
    ParameterSet.snapshot(leaf).pipe(
      Effect.map((snapshot) => Record.map(snapshot, (parameters) => withInstructions(parameters, instructions)))
    )
  const nest = (name: string, subModules: Module.ComposeSubModules) =>
    Module.compose(
      new Module.ComposeOptions({ name, signature, subModules, forward: ({ input }) => leaf.forward(input) })
    )
  const compose = (subModules: Module.ComposeSubModules) => nest("qa", subModules)
  const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
  const answer = <E, R>(
    root: Module.Module<{ question: typeof Schema.String }, { answer: typeof Schema.String }, E, R>
  ) =>
    root.forward({ question: "q" }).pipe(
      Effect.map((output) => output.answer),
      Effect.provideService(LanguageModel.LanguageModel, lm.service)
    )
  return { signature, leaf, withDefault, nest, compose, answer }
})

describe("shared bound projections", () => {
  it.effect("rejects a shared predictor bound under one alias and plain under another in either alias order", () =>
    Effect.gen(function*() {
      const { compose, leaf, withDefault } = yield* makeSharedFixture
      const bound = Module.bound(leaf, yield* withDefault("bound-default"))
      yield* Effect.forEach(
        Arr.make(
          Record.set(Record.singleton("a", bound), "b", leaf),
          Record.set(Record.singleton("a", leaf), "z", bound)
        ),
        (subModules) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(compose(subModules))
            expect(error._tag).toBe("CompositionError")
            expect(error.message).toContain("inconsistent bound defaults")
            expect(error.moduleName).toBe("generate")
          }),
        { discard: true }
      )
      expect((yield* Ref.get(leaf.parameters)).instructions).not.toContain("bound-default")
    }))

  it.effect("traces effective defaults through nested projections and rejects every inconsistent shape", () =>
    Effect.gen(function*() {
      const { compose, leaf, nest, withDefault } = yield* makeSharedFixture
      const bound = Module.bound(leaf, yield* withDefault("bound-default"))
      const other = Module.bound(leaf, yield* withDefault("other-default"))
      const inner = yield* nest("inner", Record.singleton("x", bound))
      const sharedInner = yield* nest("inner", Record.set(Record.singleton("x", leaf), "y", leaf))
      const conflicting = Module.bound(sharedInner, {
        "inner.x": withInstructions(yield* Ref.get(leaf.parameters), "x-default"),
        "inner.y": withInstructions(yield* Ref.get(leaf.parameters), "y-default")
      })
      yield* Effect.forEach(
        Arr.make(
          Record.set(Record.singleton("a", inner), "b", leaf),
          Record.set(Record.singleton("a", leaf), "z", inner),
          Record.set(Record.singleton("a", inner), "b", other),
          Record.set(Record.singleton("a", other), "z", inner),
          Record.singleton("i", conflicting)
        ),
        (subModules) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(compose(subModules))
            expect(error._tag).toBe("CompositionError")
            expect(error.message).toContain("inconsistent bound defaults")
          }),
        { discard: true }
      )
    }))

  it.effect("accepts equivalent nested projections and applies their single effective default on every path", () =>
    Effect.gen(function*() {
      const { answer, compose, leaf, nest, withDefault } = yield* makeSharedFixture
      const bound = Module.bound(leaf, yield* withDefault("bound-default"))
      const equivalent = Module.bound(leaf, yield* withDefault("bound-default"))
      const inner = yield* nest("inner", Record.singleton("x", bound))
      yield* Effect.forEach(
        Arr.make(
          Record.set(Record.singleton("a", bound), "b", equivalent),
          Record.set(Record.singleton("a", equivalent), "z", bound),
          Record.set(Record.singleton("a", inner), "b", equivalent),
          Record.set(Record.singleton("a", equivalent), "z", inner)
        ),
        (subModules) =>
          Effect.gen(function*() {
            const root = yield* compose(subModules)
            expect(yield* answer(root)).toContain("bound-default")
            expect(Record.values(yield* ParameterSet.snapshot(root))).toEqual(
              Record.values(yield* withDefault("bound-default"))
            )
          }),
        { discard: true }
      )
      expect((yield* Ref.get(leaf.parameters)).instructions).not.toContain("bound-default")
    }))

  it.effect("applies a bound snapshot of a shared subtree regardless of which alias keys the predictor", () =>
    Effect.gen(function*() {
      const { answer, compose, leaf, nest } = yield* makeSharedFixture
      const sharedInner = yield* nest("inner", Record.set(Record.singleton("x", leaf), "y", leaf))
      const original = yield* Ref.get(leaf.parameters)
      yield* Effect.forEach(
        Arr.make(Tuple.make("inner.x", "canonical-default"), Tuple.make("inner.y", "alias-default")),
        ([path, instructions]) =>
          Effect.gen(function*() {
            const root = yield* compose(
              Record.singleton(
                "i",
                Module.bound(sharedInner, Record.singleton(path, withInstructions(original, instructions)))
              )
            )
            expect(yield* answer(root)).toContain(instructions)
            expect(yield* ParameterSet.snapshot(root)).toEqual({
              "qa.i.x": withInstructions(original, instructions)
            })
          }),
        { discard: true }
      )
      expect(yield* Ref.get(leaf.parameters)).toEqual(original)
    }))
})
