/**
 * Process-local runtime identities used by automatic predictor caching live
 * exactly as long as the Cache layer that allocated them. Declared model
 * identities remain durable across layer lifetimes.
 */
import { describe, expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as SearchCache from "@scenesystems/effect-search/Cache"
import { Context, Effect, Layer, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { TestConsole } from "effect/testing"
import * as Cache from "../../src/Cache.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"
import * as Module from "../../src/Module.js"
import * as Signature from "../../src/Signature.js"

const answering = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  return yield* Module.predict("qa", signature)
})

describe("automatic cache identity lifecycle", () => {
  it.effect("releases anonymous runtime partitions with their Cache layer but keeps declared identities durable", () =>
    Effect.gen(function*() {
      const module = yield* answering
      const backend = yield* Layer.build(SearchCache.layerMemory)
      const anonymous = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "anonymous" }))
      const declared = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "declared" }), "durable")
      const twiceInOneLayer = (lm: MockLanguageModel.Runtime, binder: ModelBinder.Binder, answer: string) =>
        Effect.gen(function*() {
          expect(yield* module.forward({ question: "q" })).toEqual({ answer })
          expect(yield* module.forward({ question: "q" })).toEqual({ answer })
        }).pipe(
          ModelBinder.withBinder(binder),
          Effect.provideService(LanguageModel.LanguageModel, lm.service),
          Effect.provide(Cache.layer),
          Effect.provide(backend)
        )
      yield* twiceInOneLayer(anonymous, ModelBinder.identity, "anonymous")
      yield* twiceInOneLayer(anonymous, ModelBinder.identity, "anonymous")
      yield* twiceInOneLayer(declared, declared.binder, "declared")
      yield* twiceInOneLayer(declared, declared.binder, "declared")
      expect(yield* Ref.get(anonymous.calls)).toHaveLength(2)
      expect(yield* Ref.get(declared.calls)).toHaveLength(1)
      expect(yield* TestConsole.logLines).toEqual([])
    }))

  it.effect("separates one anonymous service under different binders and reuses each pair within the layer", () =>
    Effect.gen(function*() {
      const module = yield* answering
      const lm = yield* MockLanguageModel.make(MockLanguageModel.sequence([{ answer: "first" }, { answer: "second" }]))
      const first = new ModelBinder.Binder({ bind: () => (effect) => effect })
      const second = new ModelBinder.Binder({ bind: () => (effect) => effect })
      const call = (binder: ModelBinder.Binder) =>
        module.forward({ question: "q" }).pipe(ModelBinder.withBinder(binder))
      const outputs = yield* Effect.all([call(first), call(first), call(second), call(second), call(first)]).pipe(
        Effect.provideService(LanguageModel.LanguageModel, lm.service)
      )
      expect(outputs).toEqual([
        { answer: "first" },
        { answer: "first" },
        { answer: "second" },
        { answer: "second" },
        { answer: "first" }
      ])
      expect(yield* Ref.get(lm.calls)).toHaveLength(2)
      expect(yield* TestConsole.logLines).toEqual([])
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("memoizes only declared identities through a Cache service installed without its layer", () =>
    Effect.gen(function*() {
      const module = yield* answering
      const service = Context.get(yield* Layer.build(Cache.layerMemory), Cache.Cache)
      const anonymous = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "anonymous" }))
      const declared = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "declared" }), "durable")
      const twice = (lm: MockLanguageModel.Runtime, binder: ModelBinder.Binder) =>
        Effect.all([module.forward({ question: "q" }), module.forward({ question: "q" })]).pipe(
          ModelBinder.withBinder(binder),
          Effect.provideService(LanguageModel.LanguageModel, lm.service),
          Effect.provideService(Cache.Cache, service)
        )
      expect(yield* twice(anonymous, ModelBinder.identity)).toEqual([{ answer: "anonymous" }, { answer: "anonymous" }])
      expect(yield* twice(declared, declared.binder)).toEqual([{ answer: "declared" }, { answer: "declared" }])
      expect(yield* Ref.get(anonymous.calls)).toHaveLength(2)
      expect(yield* Ref.get(declared.calls)).toHaveLength(1)
      expect(yield* TestConsole.logLines).toEqual([])
    }))
})
