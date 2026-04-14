import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Ref, Schema } from "effect"
import { Example } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"

import { FixtureRegistry, LabeledFewShotSampleFixtureSchema } from "../../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

describe("Optimizer.labeledFewShot DSPy parity", () => {
  it.effect("matches fixture-backed seeded sample selection without LM calls", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.labeledfewshot.sample-k.seed-9")
      const fixture = yield* Schema.decodeUnknown(LabeledFewShotSampleFixtureSchema)(rawFixture)

      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa-labeledfewshot-dspy-parity", signature)
      const trainset = Arr.map(
        fixture.payload.trainset,
        (example) =>
          new Example({
            input: { question: example.question },
            output: { answer: example.answer }
          })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "should-not-be-called" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const optimized = yield* Optimizer.labeledFewShot({
        module,
        trainset,
        k: fixture.payload.k,
        seed: fixture.payload.seed
      }).pipe(Effect.provide(layer))

      const params = yield* Ref.get(optimized.params)
      const calls = yield* Ref.get(mock.calls)
      const selectedQuestions = Arr.map(params.demos, (demo) => String(demo.input.question ?? ""))

      expect(selectedQuestions).toStrictEqual(fixture.payload.expectedSelectedQuestions)
      expect(calls).toHaveLength(fixture.payload.expectedCallCount)
    }))
})
