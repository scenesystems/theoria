/**
 * Optimizers score decoded outputs and retain encoded demonstration documents.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { BootstrapFailed } from "@scenesystems/effect-dsp/Errors"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Effect, Number, ParseResult, Ref, Schema } from "effect"
import { decodePayload } from "../../src/contracts/Payload.js"
import { PredictorInstruction, ProgramCandidate } from "../../src/optimizers/GEPA/model.js"
import { evaluateCandidate } from "../../src/optimizers/GEPA/runtime/evaluate.js"

const Input = Schema.Struct({ seed: Schema.NumberFromString })
const Output = Schema.Struct({ result: Schema.Struct({ count: Schema.NumberFromString }) })
const example = new Example({ input: { seed: "04" }, output: { result: { count: "03" } } })
const invalidExample = new Example({ input: { seed: "04" }, output: { result: { count: "invalid" } } })
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

const metric = Metric.make("difference", (prediction: typeof Output.Type, expected) => {
  expectTypeOf(expected).toEqualTypeOf<typeof Output.Type>()
  expect(prediction.result.count).toBe(7)
  expect(expected.result.count).toBe(3)
  return new Metric.Result({ score: Number.subtract(prediction.result.count, expected.result.count) })
})

describe("optimizer schema-derived metric values", () => {
  it.effect("scores transformed bootstrap outputs and promotes wire values into replayable demos", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      yield* Optimizer.bootstrapFewShot({
        module,
        trainset: Arr.make(example),
        metric,
        maxRounds: 1,
        maxBootstrappedDemos: 1,
        threshold: 4,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const params = yield* Ref.get(module.params)
      const demo = yield* Arr.head(params.demos)
      expect(demo.input).toEqual({ seed: "4" })
      expect(demo.output).toEqual({ result: { count: "7" } })
      expect(yield* Schema.decodeUnknown(Output)(demo.output)).toEqual({ result: { count: 7 } })
    }))

  it.effect("rejects malformed bootstrap labels through the checked failure channel before model execution", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      const failure = yield* Optimizer.bootstrapFewShot({
        module,
        trainset: Arr.make(invalidExample),
        metric,
        maxRounds: 1,
        maxBootstrappedDemos: 1
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)
      expect(failure).toBeInstanceOf(BootstrapFailed)
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(0)
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))

  it.effect("scores decoded GEPA outputs and stores schema-encoded reflection documents", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      const evaluation = yield* evaluateCandidate(
        { module, trainset: Arr.make(example), metric, maxIterations: 0 },
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(evaluation.scores).toEqual(Arr.make(4))
      const sample = yield* Arr.head(evaluation.samples)
      expect(yield* decodePayload(Schema.encodedSchema(Input), sample.inputs)).toEqual({ seed: "4" })
      expect(yield* decodePayload(Schema.encodedSchema(Output), sample.generatedOutputs)).toEqual({
        result: { count: "7" }
      })
      expect(yield* decodePayload(Output, sample.expectedOutput)).toEqual({ result: { count: 3 } })
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))

  it.effect("restores GEPA parameters when expected output decoding fails", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const original = yield* Ref.get(module.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      const failure = yield* evaluateCandidate(
        { module, trainset: Arr.make(invalidExample), metric, maxIterations: 0 },
        candidate
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      expect(failure).toBeInstanceOf(ParseResult.ParseError)
      expect(Arr.length(yield* Ref.get(mock.calls))).toBe(0)
      expect(yield* Ref.get(module.params)).toEqual(original)
    }))
})
