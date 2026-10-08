/**
 * The Cache layer owns the registry of anonymous runtime identities: one
 * identity per model and binder object pair while the layer is open, and no
 * retained runtime once its scope closes.
 */
import { describe, expect, it } from "@effect/vitest"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Context, Effect, Exit, Layer, Option, Ref, Scope } from "effect"
import * as Cache from "../../src/Cache.js"
import * as LocalIdentities from "../../src/internal/cache/identities.js"
import * as MockLanguageModel from "../../src/MockLanguageModel.js"

describe("Cache layer identity registry", () => {
  it.effect("identifies object pairs stably within the layer and releases them when its scope closes", () =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const context = yield* Layer.buildWithScope(Cache.layerMemory, scope)
      const registry = Option.match(Context.getOption(context, LocalIdentities.LocalIdentities), {
        onNone: () => expect.fail("Cache.layerMemory must own an anonymous identity registry"),
        onSome: (service) => service
      })
      const first = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "first" }))
      const second = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "second" }))
      const binder = new ModelBinder.Binder({ bind: () => (effect) => effect })
      const identify = (model: MockLanguageModel.Runtime, selected: ModelBinder.Binder) =>
        LocalIdentities.identify(registry, model.service, selected)
      const firstIdentity = yield* identify(first, ModelBinder.identity)
      const firstAgain = yield* identify(first, ModelBinder.identity)
      const secondIdentity = yield* identify(second, ModelBinder.identity)
      const rebound = yield* identify(first, binder)
      const reboundAgain = yield* identify(first, binder)
      expect([firstAgain, reboundAgain]).toEqual([firstIdentity, rebound])
      expect(Arr.dedupe([firstIdentity, secondIdentity, rebound])).toHaveLength(3)
      expect(Arr.map(yield* Ref.get(registry.entries), (entry) => entry.id)).toEqual([
        firstIdentity,
        secondIdentity,
        rebound
      ])
      yield* Scope.close(scope, Exit.void)
      expect(yield* Ref.get(registry.entries)).toEqual([])
    }))
})
