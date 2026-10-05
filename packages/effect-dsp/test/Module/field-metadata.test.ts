import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Record, Schema, Struct } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as ParameterSet from "../../src/ParameterSet.js"
import * as Signature from "../../src/Signature.js"

describe("editable signature metadata", () => {
  it.effect("supports output-only signatures and pure construction-time metadata edits", () =>
    Effect.gen(function*() {
      const base = yield* Signature.outputOnly({ answer: Schema.String })
      const edited = Signature.withFieldDescription(
        Signature.withFieldPrefix(Signature.withInstruction(base, "Return a city"), "answer", "City:"),
        "answer",
        "City name"
      )
      const module = yield* Module.predict("city", edited)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      const output = yield* module.forward({}).pipe(Effect.provideService(LanguageModel.LanguageModel, lm.service))
      expect(output.answer).toContain("Return a city")
      expect(output.answer).toContain("answer (City:): City name")
      expect(base.instructions).not.toContain("Return a city")
      expect(base.fields[0]?.prefix).toEqual(Option.none())
    }))

  it.effect("pairs metadata with renamed wire keys without renaming the protocol", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.fromSchemas(
        "Answer",
        Schema.Struct({ question: Schema.String }).pipe(Schema.encodeKeys({ question: "query" })),
        Schema.Struct({ answer: Schema.String }).pipe(Schema.encodeKeys({ answer: "result" }))
      )
      const module = yield* Module.predict("qa", Signature.withFieldPrefix(signature, "question", "Your question:"))
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ result: prompt })))
      const output = yield* module.forward({ question: "q" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(output.answer).toContain("query (Your question:)")
      expect(output.answer).toContain("[[ ## query ## ]]")
      expect(output.answer).toContain("[[ ## result ## ]]")
    }))

  it.effect("restores field metadata through load and renders it without changing wire keys", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const parameters = Record.map(
        yield* ParameterSet.snapshot(module),
        (params) =>
          new ModuleParameters(Struct.assign(params, {
            fields: { question: { prefix: Option.some("Question supplied:"), description: Option.some("User query") } }
          }))
      )
      yield* Module.load(module, new Module.SavedState({ parameters }))
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      const prediction = yield* Module.call(module, { question: "why?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(prediction.output.answer).toContain("Question supplied:")
      expect(prediction.output.answer).toContain("User query")
      expect(prediction.output.answer).toContain("[[ ## question ## ]]")
      expect(yield* ParameterSet.snapshot(module)).toEqual(parameters)
    }))

  it.effect("renders independent sibling metadata overlays and preserves the base", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const left = yield* Module.predict("left", signature)
      const right = yield* Module.predict("right", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: { left, right },
          forward: ({ input }) =>
            Effect.zipWith(left.forward(input), right.forward(input), (a, b) => ({ answer: a.answer + b.answer }))
        })
      )
      const before = yield* ParameterSet.snapshot(root)
      const parameters = Record.map(before, (params, path) =>
        new ModuleParameters(Struct.assign(params, {
          fields: { question: { prefix: Option.some(path), description: Option.none() } }
        })))
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      const prediction = yield* Module.call(root, { question: "q" }).pipe(
        Module.withParameters(parameters),
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(prediction.output.answer).toContain("root.left")
      expect(prediction.output.answer).toContain("root.right")
      expect(yield* ParameterSet.snapshot(root)).toEqual(before)
    }))
})
