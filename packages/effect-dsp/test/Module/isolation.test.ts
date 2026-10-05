import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Record, Ref, Schema, String as Str } from "effect"
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
        const parameters = Record.map(before, (params) => withInstructions(params, `candidate-${index}`))
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
      expect((yield* Ref.get(leaf.params)).instructions).toBe(signature.instructions)
    }))

  it.effect("preserves bound defaults when composed and lets root overlays win", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const leaf = yield* Module.predict("generate", signature)
      const defaults = Record.map(yield* ParameterSet.snapshot(leaf), (params) =>
        withInstructions(params, "bound-default"))
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
      const override = Record.map(snapshot, (params) => withInstructions(params, "explicit-override"))
      const output = yield* root.forward({ question: "q" }).pipe(
        Module.withParameters(override),
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(output.answer).toContain("explicit-override")
      expect(output.answer).not.toContain("bound-default")
      expect((yield* Ref.get(leaf.params)).instructions).toBe(signature.instructions)
    }))
})
