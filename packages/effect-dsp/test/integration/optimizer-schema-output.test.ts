/**
 * Optimizers score decoded outputs and retain encoded demonstration documents.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { decode as decodePayload } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Number, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { PredictorInstruction, ProgramCandidate } from "../../src/internal/gepa/model.js"
import { evaluateCandidate } from "../../src/internal/gepa/runtime/evaluate.js"

const Input = Schema.Struct({ seed: Schema.FiniteFromString })
const Output = Schema.Struct({ result: Schema.Struct({ count: Schema.FiniteFromString }) })
const example = new Example({ input: { seed: "04" }, labels: Option.some({ result: { count: "03" } }) })
const invalidExample = new Example({ input: { seed: "04" }, labels: Option.some({ result: { count: "invalid" } }) })
const candidate = new ProgramCandidate({
  candidateId: "candidate",
  parentIds: Arr.empty(),
  predictorInstructions: Arr.make(
    new PredictorInstruction({ predictorName: "counter", instruction: "Try another instruction" })
  )
})

const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make("Count", Input.fields, Output.fields)
  return yield* Module.predict("counter", signature)
})

const metric = Metric.withFeedback((example, result) =>
  Effect.gen(function*() {
    const prediction = yield* Schema.decodeUnknownEffect(Schema.toType(Output))(result.output)
    const expected = yield* Schema.decodeUnknownEffect(Output)(Option.getOrElse(example.labels, () => ({})))
    expectTypeOf(expected).toEqualTypeOf<typeof Output.Type>()
    expect(prediction.result.count).toBe(7)
    expect(expected.result.count).toBe(3)
    return new Metric.Score({
      value: Number.subtract(prediction.result.count, expected.result.count),
      feedback: Option.none()
    })
  }), "difference")

describe("optimizer schema-derived metric values", () => {
  it.effect("scores transformed bootstrap outputs and promotes wire values into replayable demos", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ result: { count: "7" } }))
      const compiled = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.make(example),
          metric,
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          threshold: 4,
          fallbackToLabeledFewShot: false
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const params = Option.getOrThrow(Record.get(compiled.parameters, module.name))
      const demo = Option.getOrThrow(Arr.head(params.demos))
      expect(demo.input).toEqual({ seed: "4" })
      expect(demo.output).toEqual({ result: { count: "7" } })
      expect(yield* Schema.decodeUnknownEffect(Output)(demo.output)).toEqual({ result: { count: 7 } })
    }))

  it.effect("preserves the scorer's checked label validation failure after model execution", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ result: { count: "7" } }))
      const failure = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module,
          trainset: Arr.make(invalidExample),
          metric,
          maxRounds: 1,
          maxBootstrappedDemos: 1
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
      expect(failure).toBeInstanceOf(Schema.SchemaError)
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(1)
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))

  it.effect("scores decoded GEPA outputs and stores schema-encoded reflection documents", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ result: { count: "7" } }))
      const evaluation = yield* evaluateCandidate(
        new GEPA.Options({ module, trainset: Arr.make(example), metric, maxIterations: 0 }),
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(evaluation.scores).toEqual(Arr.make(4))
      const sample = Option.getOrThrow(Arr.head(evaluation.samples))
      expect(yield* decodePayload(Schema.toEncoded(Input), sample.inputs)).toEqual({ seed: "4" })
      expect(yield* decodePayload(Schema.toEncoded(Output), sample.generatedOutputs)).toEqual({
        result: { count: "7" }
      })
      expect(yield* decodePayload(Output, sample.expectedOutput)).toEqual({ result: { count: 3 } })
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))

  it.effect("preserves GEPA parameters when the scorer rejects raw labels", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ result: { count: "7" } }))
      const failure = yield* evaluateCandidate(
        new GEPA.Options({ module, trainset: Arr.make(invalidExample), metric, maxIterations: 0 }),
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      expect(failure).toBeInstanceOf(Schema.SchemaError)
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(1)
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))
})
