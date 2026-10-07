import { describe, expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as SearchCache from "@scenesystems/effect-search/Cache"
import { Array as Arr, Cause, Effect, Exit, Option, Record, Ref, Schema, Struct } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { TestConsole } from "effect/testing"
import * as Cache from "../../src/Cache.js"
import * as LabeledFewShot from "../../src/LabeledFewShot.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import { ModuleParameters } from "../../src/ModuleParameters.js"
import * as ParameterSet from "../../src/ParameterSet.js"
import * as Signature from "../../src/Signature.js"

describe("automatic predictor cache", () => {
  it.effect("caches all temperatures, partitions settings and honors never", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const deterministic = yield* Module.predict("qa", signature)
      const stochastic = yield* Module.predict(
        "qa",
        signature,
        new Module.PredictOptions({ settings: new ModelSettings({ temperature: 0.7 }) })
      )
      const never = yield* Module.predict("qa", signature, new Module.PredictOptions({ cache: "never" }))
      const lm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "ok" }))
      yield* Effect.gen(function*() {
        yield* Module.call(deterministic, { question: "q" })
        const hit = yield* Module.call(deterministic, { question: "q" })
        expect(yield* TestConsole.logLines).toEqual([])
        expect(hit.output).toEqual({ answer: "ok" })
        expect(hit.usage.callCount).toBe(0)
        expect(yield* Ref.get(lm.calls)).toHaveLength(1)
        yield* stochastic.forward({ question: "q" })
        yield* stochastic.forward({ question: "q" })
        yield* never.forward({ question: "q" })
        yield* never.forward({ question: "q" })
        expect(yield* Ref.get(lm.calls)).toHaveLength(4)
      }).pipe(ModelBinder.withBinder(lm.binder), Effect.provideService(LanguageModel.LanguageModel, lm.service))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("caches an immutable optimizer result forwarded twice without digest warnings", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "ok" }))
      const result = yield* LabeledFewShot.run(new LabeledFewShot.Options({ module, trainset: [], k: 0 }))
      yield* Effect.gen(function*() {
        expect(yield* result.program.forward({ question: "q" })).toEqual({ answer: "ok" })
        expect(yield* result.program.forward({ question: "q" })).toEqual({ answer: "ok" })
      }).pipe(ModelBinder.withBinder(lm.binder), Effect.provideService(LanguageModel.LanguageModel, lm.service))
      expect(yield* TestConsole.logLines).toEqual([])
      expect(yield* Ref.get(lm.calls)).toHaveLength(1)
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("warns on failed reads and writes without repeating or failing the model call", () =>
    Effect.gen(function*() {
      const cache = yield* Cache.Cache
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const output = yield* module.forward({ question: "q" }).pipe(
        Effect.provideService(Cache.Cache, {
          ...cache,
          get: () => Effect.fail(new SearchCache.BackendError({ operation: "get", reason: "offline" })),
          set: () => Effect.fail(new SearchCache.BackendError({ operation: "put", reason: "offline" }))
        }),
        ModelBinder.withBinder(lm.binder),
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(output).toEqual({ answer: "Paris" })
      expect(yield* Ref.get(lm.calls)).toHaveLength(1)
      expect(Arr.filter(yield* TestConsole.logLines, (line) => line === "Predictor cache operation failed"))
        .toHaveLength(2)
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("partitions effective metadata, instructions, roles, settings and rollouts", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const teacher = yield* Module.predict("qa", signature, new Module.PredictOptions({ role: "teacher" }))
      const limited = yield* Module.predict(
        "qa",
        signature,
        new Module.PredictOptions({ settings: new ModelSettings({ maxTokens: 73 }) })
      )
      const otherSignature = yield* Module.predict(
        "qa",
        Signature.withFieldDescription(signature, "answer", "Precise answer")
      )
      const lm = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({ answer: prompt })))
      const base = yield* ParameterSet.snapshot(module)
      yield* Effect.gen(function*() {
        yield* module.forward({ question: "q" })
        yield* module.forward({ question: "q" })
        yield* teacher.forward({ question: "q" })
        yield* limited.forward({ question: "q" })
        yield* otherSignature.forward({ question: "q" })
        const edited = Record.map(base, (parameters) =>
          new ModuleParameters(Struct.assign(parameters, {
            fields: { question: { prefix: Option.some("Edited prefix"), description: Option.none() } }
          })))
        const output = yield* module.forward({ question: "q" }).pipe(Module.withParameters(edited))
        expect(output.answer).toContain("Edited prefix")
        yield* module.forward({ question: "q" }).pipe(Module.withParameters(Record.map(base, (parameters) =>
          new ModuleParameters(Struct.assign(parameters, { instructions: "Different instructions" })))))
        yield* Cache.withRollout(9, module.forward({ question: "q" }))
        expect(yield* Ref.get(lm.calls)).toHaveLength(7)
      }).pipe(ModelBinder.withBinder(lm.binder), Effect.provideService(LanguageModel.LanguageModel, lm.service))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("reuses declared model identities across runtime objects, but separates different models", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const first = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "first" }), "a")
      const same = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "same" }), "a")
      const other = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "other" }), "b")
      const run = (lm: MockLanguageModel.Runtime) =>
        module.forward({ question: "q" }).pipe(
          ModelBinder.withBinder(lm.binder),
          Effect.provideService(LanguageModel.LanguageModel, lm.service)
        )
      expect(yield* run(first)).toEqual({ answer: "first" })
      expect(yield* run(same)).toEqual({ answer: "first" })
      expect(yield* Ref.get(same.calls)).toHaveLength(0)
      expect(yield* run(other)).toEqual({ answer: "other" })
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("partitions omitted settings by declared defaults and stochastic calls by rollout", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const low = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "low" }),
        "same",
        new ModelSettings({ temperature: 0.2 })
      )
      const high = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "high" }),
        "same",
        new ModelSettings({ temperature: 0.8 })
      )
      const run = (lm: MockLanguageModel.Runtime, rollout: number) =>
        Cache.withRollout(rollout, module.forward({ question: "q" })).pipe(
          ModelBinder.withBinder(lm.binder),
          Effect.provideService(LanguageModel.LanguageModel, lm.service)
        )
      expect(yield* run(low, 1)).toEqual({ answer: "low" })
      expect(yield* run(high, 1)).toEqual({ answer: "high" })
      yield* run(high, 1)
      yield* run(high, 2)
      yield* run(high, 2)
      expect(yield* Ref.get(low.calls)).toHaveLength(1)
      expect(yield* Ref.get(high.calls)).toHaveLength(2)
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("isolates anonymous native runtimes by object identity", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const first = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "first" }))
      const second = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "second" }))
      const run = (lm: MockLanguageModel.Runtime) =>
        module.forward({ question: "q" }).pipe(Effect.provideService(LanguageModel.LanguageModel, lm.service))
      expect(yield* run(first)).toEqual({ answer: "first" })
      expect(yield* run(second)).toEqual({ answer: "second" })
      yield* run(first)
      yield* run(second)
      expect(yield* Ref.get(first.calls)).toHaveLength(1)
      expect(yield* Ref.get(second.calls)).toHaveLength(1)
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("does not swallow interruption from a cache operation", () =>
    Effect.gen(function*() {
      const cache = yield* Cache.Cache
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("qa", signature)
      const lm = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "unused" }))
      const exit = yield* module.forward({ question: "q" }).pipe(
        Effect.provideService(Cache.Cache, { ...cache, get: () => Effect.interrupt }),
        Effect.provideService(LanguageModel.LanguageModel, lm.service),
        Effect.exit
      )
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(yield* Ref.get(lm.calls)).toHaveLength(0)
    }).pipe(Effect.provide(Cache.layerMemory)))
})
