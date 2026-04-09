/**
 * LabeledFewShot optimizer contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Record as Rec, Ref } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const labeledTrainset = [
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  }),
  new Example({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" }
  })
]

describe("Optimizer.labeledFewShot", () => {
  it.effect("attaches k labeled demos without any LanguageModel calls", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "should-not-be-called" })
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const optimized = yield* Optimizer.labeledFewShot({
        module,
        trainset: labeledTrainset,
        k: 2,
        seed: 11
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)

      expect(params.demos).toHaveLength(2)
      expect(params.demos.every((demo) => Rec.keys(demo.output).length > 0)).toBe(true)
      expect(calls).toHaveLength(0)
    }))

  it.effect("applies the selected demos to composed predictor graphs", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const qa = yield* Module.predict("qa", signature)
      const root = yield* Module.compose({
        name: "qa-root",
        signature,
        subModules: { qa },
        forward: ({ input }) => qa.forward(input)
      })

      yield* Optimizer.labeledFewShot({
        module: root,
        trainset: labeledTrainset,
        k: 1,
        seed: 3
      })

      const rootParams = yield* Ref.get(root.params)
      const qaParams = yield* Ref.get(qa.params)

      expect(rootParams.demos).toHaveLength(1)
      expect(qaParams.demos).toHaveLength(1)
      expect(rootParams.demos).toEqual(qaParams.demos)
    }))

  it.effect("is deterministic for identical seeds and inputs", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)

      const initial = yield* Ref.get(module.params)
      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initial.instructions,
          demos: [],
          outputStrategy: "auto"
        })
      )

      yield* Optimizer.labeledFewShot({
        module,
        trainset: labeledTrainset,
        k: 2,
        seed: 19
      })
      const first = yield* Ref.get(module.params)

      yield* Ref.set(
        module.params,
        new ModuleParams({
          instructions: initial.instructions,
          demos: [],
          outputStrategy: "auto"
        })
      )

      yield* Optimizer.labeledFewShot({
        module,
        trainset: labeledTrainset,
        k: 2,
        seed: 19
      })
      const second = yield* Ref.get(module.params)

      expect(second.demos).toEqual(first.demos)
    }))
})
