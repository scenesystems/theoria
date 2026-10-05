import { describe, expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Effect, Match, Option, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"
import * as Cache from "../../src/Cache.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as Signature from "../../src/Signature.js"

describe("predictor model settings", () => {
  it.effect("binds sibling settings independently for text and structured requests", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      yield* Effect.forEach(Schema.Literals(["text", "structured"]).literals, (outputStrategy) =>
        Effect.gen(function*() {
          const lm = yield* MockLanguageModel.make(MockLanguageModel.succeed(
            Match.value(outputStrategy).pipe(
              Match.when("text", () => "[[ ## answer ## ]]\nok"),
              Match.when("structured", () => ({ answer: "ok" })),
              Match.exhaustive
            )
          ))
          const left = yield* Module.predict("left", signature)
          const right = yield* Module.predict(
            "right",
            signature,
            new Module.PredictOptions({
              settings: new ModelSettings({ temperature: 0 }),
              role: "teacher"
            })
          )
          yield* Ref.set(
            left.params,
            new ModuleParameters({
              instructions: "left",
              demos: [],
              outputStrategy,
              temperature: 0.17,
              maxTokens: 73
            })
          )
          yield* Ref.set(
            right.params,
            new ModuleParameters({
              instructions: "right",
              demos: [],
              outputStrategy,
              temperature: 0.83,
              maxTokens: 211
            })
          )
          yield* Effect.all([left.forward({ question: "a" }), right.forward({ question: "b" })], {
            concurrency: "unbounded"
          }).pipe(
            (effect) => Cache.withRollout(23, effect),
            ModelBinder.withBinder(lm.binder),
            Effect.provideService(LanguageModel.LanguageModel, lm.service)
          )
          const calls = yield* Ref.get(lm.calls)
          expect(Arr.map(calls, (call) => call.settings)).toEqual([
            new ModelSettings({ temperature: 0.17, maxTokens: 73 }),
            new ModelSettings({ temperature: 0, maxTokens: 211 })
          ])
          expect(Arr.map(calls, (call) => call.role)).toEqual(["task", "teacher"])
          expect(Arr.map(calls, (call) => call.rolloutId)).toEqual([Option.some(23), Option.some(23)])
        }))
    }))

  it.effect("binds distinct settings through tool turns and their continuations", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const lookup = Tool.make("Lookup", { parameters: Schema.Struct({}), success: Schema.String })
      const tools = Toolkit.make(lookup)
      const toolkit = yield* tools.pipe(Effect.provide(tools.toLayer({ Lookup: () => Effect.succeed("ok") })))
      const lm = yield* MockLanguageModel.make(MockLanguageModel.sequence([
        [Response.toolCallPart({ id: "first", name: "Lookup", params: {}, providerExecuted: false })],
        "[[ ## answer ## ]]\nok",
        [Response.toolCallPart({ id: "second", name: "Lookup", params: {}, providerExecuted: false })],
        "[[ ## answer ## ]]\nok"
      ]))
      const left = yield* Module.react(new Module.ReactOptions({ name: "left", signature, toolkit }))
      const right = yield* Module.react(new Module.ReactOptions({ name: "right", signature, toolkit }))
      yield* Ref.set(
        left.params,
        new ModuleParameters({ instructions: "left", demos: [], temperature: 0.17, maxTokens: 73 })
      )
      yield* Ref.set(
        right.params,
        new ModuleParameters({ instructions: "right", demos: [], temperature: 0.83, maxTokens: 211 })
      )
      const outputs = yield* Effect.forEach([left, right], (module) => module.forward({ question: "answer" })).pipe(
        ModelBinder.withBinder(lm.binder),
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(outputs).toEqual([{ answer: "ok" }, { answer: "ok" }])
      expect(Arr.map(yield* Ref.get(lm.calls), (call) => call.settings)).toEqual([
        new ModelSettings({ temperature: 0.17, maxTokens: 73 }),
        new ModelSettings({ temperature: 0.17, maxTokens: 73 }),
        new ModelSettings({ temperature: 0.83, maxTokens: 211 }),
        new ModelSettings({ temperature: 0.83, maxTokens: 211 })
      ])
    }))
})
