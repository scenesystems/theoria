/**
 * LabeledFewShot optimizer contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as LabeledFewShot from "@scenesystems/effect-dsp/LabeledFewShot"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ParameterSet from "@scenesystems/effect-dsp/ParameterSet"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Layer, Option, Record as Rec, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { assertNoMutation } from "../kit/Mutation.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

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

describe("LabeledFewShot.run", () => {
  it.effect("optimizes a shared leaf once and preserves an executed frozen sibling", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const shared = yield* Module.predict("shared", signature)
      const frozen = Module.freeze(yield* Module.predict("frozen", signature))
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature,
          subModules: { a: shared, b: shared, frozen },
          forward: ({ input }) => shared.forward(input).pipe(Effect.andThen(frozen.forward(input)))
        })
      )
      const optimized = yield* assertNoMutation(
        root,
        LabeledFewShot.run(
          new LabeledFewShot.Options({
            module: root,
            trainset: labeledTrainset,
            k: 1,
            seed: 3
          })
        )
      )
      expect(Rec.keys(optimized.parameters)).toEqual(["root.a", "root.frozen"])
      expect(Option.getOrThrow(Rec.get(optimized.parameters, "root.a")).demos).toHaveLength(1)
      expect(Option.getOrThrow(Rec.get(optimized.parameters, "root.frozen")).demos).toHaveLength(0)
      const model = yield* MockLanguageModel.make(MockLanguageModel.sequence([
        "[[ ## answer ## ]]\nanswer",
        { answer: "answer" }
      ]))
      yield* optimized.program.forward({ question: "Execute" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      expect(Arr.map(yield* Ref.get(model.calls), (call) => call.method)).toEqual(["generateText", "generateObject"])
      const codec = Schema.fromJsonString(LabeledFewShot.Report)
      const decoded = yield* Schema.decodeEffect(codec)(yield* Schema.encodeEffect(codec)(optimized.report))
      expect(decoded.sampled).toBe(1)
      expect(decoded.seed).toBe(3)
    }))

  it.effect("attaches k labeled demos without any LanguageModel calls", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "should-not-be-called" })
      )

      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const optimized = yield* assertNoMutation(
        module,
        LabeledFewShot.run(
          new LabeledFewShot.Options({
            module,
            trainset: labeledTrainset,
            k: 2,
            seed: 11
          })
        )
      ).pipe(Effect.provide(layer))

      const params = Option.getOrThrow(Rec.get(optimized.parameters, "qa"))
      const calls = yield* Ref.get(mock.calls)

      expect(params.demos).toHaveLength(2)
      expect(Arr.every(params.demos, (demo) => Arr.length(Rec.keys(demo.output)) > 0)).toBe(true)
      expect(calls).toHaveLength(0)
      expect(optimized.report).toEqual(new LabeledFewShot.Report({ k: 2, sampled: 2, seed: 11 }))
      expect(yield* ParameterSet.snapshot(optimized.program)).toEqual(optimized.parameters)
    }))

  it.effect("applies the selected demos to composed predictor graphs", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const qa = yield* Module.predict("qa", signature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "qa-root",
          signature,
          subModules: { qa },
          forward: ({ input }) => qa.forward(input)
        })
      )

      const optimized = yield* assertNoMutation(
        root,
        LabeledFewShot.run(
          new LabeledFewShot.Options({
            module: root,
            trainset: labeledTrainset,
            k: 1,
            seed: 3
          })
        )
      )

      expect(Rec.keys(optimized.parameters)).toEqual(["qa-root.qa"])
      expect(Option.getOrThrow(Rec.get(optimized.parameters, "qa-root.qa")).demos).toHaveLength(1)
    }))

  it.effect("is deterministic for identical seeds and inputs", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      const first = yield* LabeledFewShot.run(
        new LabeledFewShot.Options({
          module,
          trainset: labeledTrainset,
          k: 2,
          seed: 19
        })
      )
      const second = yield* LabeledFewShot.run(
        new LabeledFewShot.Options({
          module,
          trainset: labeledTrainset,
          k: 2,
          seed: 19
        })
      )
      expect(second.parameters).toEqual(first.parameters)
    }))
})
