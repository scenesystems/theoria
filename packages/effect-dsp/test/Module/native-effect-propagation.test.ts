/**
 * Native module failures and requirements remain visible through consumers.
 */
import type * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { MetricResult, RolloutCount } from "@scenesystems/effect-dsp/contracts"
import type { DspError } from "@scenesystems/effect-dsp/Errors"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Boolean, Context, Data, Effect, Equal, Inspectable, Layer, Record, Schema, String } from "effect"

class NativeModuleFailure extends Schema.TaggedError<NativeModuleFailure>()(
  "NativeModuleFailure",
  { message: Schema.String }
) {}

const NativeModuleInput = Schema.Struct({
  question: Signature.describe(Schema.String, "Question")
})

const NativeModuleOutput = Schema.Struct({
  answer: Signature.describe(Schema.String, "Answer")
})

class NativeModuleDependencyValue extends Data.Class<{
  readonly result: Effect.Effect<typeof NativeModuleOutput.Type, NativeModuleFailure>
}> {}

class NativeModuleDependency extends Context.Tag("effect-dsp/test/NativeModuleDependency")<
  NativeModuleDependency,
  NativeModuleDependencyValue
>() {}

const makeSignature = () =>
  Signature.make(
    "Propagate native module effects",
    NativeModuleInput.fields,
    NativeModuleOutput.fields
  )

const makeNativeModule = Effect.gen(function*() {
  const signature = yield* makeSignature()

  return yield* Module.compose({
    name: "native-module",
    signature,
    subModules: Record.empty(),
    forward: () =>
      Effect.flatMap(
        NativeModuleDependency,
        (dependency) => dependency.result
      )
  })
})

describe("native Module E/R propagation", () => {
  it.effect("votes on structured output using the signature's decoded equivalence", () =>
    Effect.gen(function*() {
      const outputSchema = Schema.Struct({ answer: Schema.Struct({ cities: Schema.Array(Schema.String) }) })
      const signature = yield* Signature.make("Vote on nested results", NativeModuleInput.fields, outputSchema.fields)
      const outputs = Arr.make(
        outputSchema.make({ answer: { cities: Arr.make("Rome") } }),
        outputSchema.make({ answer: { cities: Arr.make("Paris", "Tokyo") } }),
        outputSchema.make({ answer: { cities: Arr.make("Paris", "Tokyo") } })
      )
      const programs = yield* Effect.forEach(outputs, (output, index) =>
        Module.compose(
          new Module.ComposeOptions({
            name: String.concat("nested-", Inspectable.toStringUnknown(index)),
            signature,
            subModules: Record.empty(),
            forward: () => Effect.succeed(output)
          })
        ))
      const ensemble = yield* Optimizer.ensemble({ programs })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("unused"))
      const result = yield* ensemble.forward({ question: "Which cities?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(result.answer.cities).toEqual(Arr.make("Paris", "Tokyo"))
    }))

  it.effect("preserves native channels through compose and bestOfN", () =>
    Effect.gen(function*() {
      const nativeModule = yield* makeNativeModule
      const nativeOperation = nativeModule.forward({ question: "question" })
      expectTypeOf<Effect.Effect.Error<typeof nativeOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Effect.Context<typeof nativeOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "unused" }))
      const wrapped = yield* Module.bestOfN({
        name: "native-best-of-n",
        module: nativeModule,
        N: RolloutCount.make(1),
        reward: () => Effect.succeed(new MetricResult({ score: 1 }))
      })
      const wrappedOperation = wrapped.forward({ question: "question" })
      expectTypeOf<Effect.Effect.Error<typeof wrappedOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Effect.Context<typeof wrappedOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const failure = yield* wrappedOperation.pipe(
        Effect.provideService(
          NativeModuleDependency,
          new NativeModuleDependencyValue({
            result: Effect.fail(new NativeModuleFailure({ message: "native failure" }))
          })
        ),
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service)),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(NativeModuleFailure)
      expect(failure.message).toBe("native failure")
    }))

  it.effect("uses native requirements through refine and evaluation", () =>
    Effect.gen(function*() {
      const nativeModule = yield* makeNativeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "unused" }))
      const refined = yield* Module.refine({
        name: "native-refine",
        module: nativeModule,
        N: RolloutCount.make(1),
        reward: () => Effect.succeed(new MetricResult({ score: 1 })),
        threshold: 1
      })
      const refinedOperation = refined.forward({ question: "question" })
      expectTypeOf<Effect.Effect.Error<typeof refinedOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Effect.Context<typeof refinedOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const metric = Metric.make("exact", (prediction: typeof NativeModuleOutput.Type, expected) =>
        new MetricResult({
          score: Boolean.match(Equal.equals(prediction.answer, expected.answer), {
            onTrue: () => 1,
            onFalse: () => 0
          })
        }))
      const evaluation = Evaluate.run({
        module: refined,
        examples: Arr.make(new Example({ input: { question: "question" }, output: { answer: "answer" } })),
        metrics: { exact: metric }
      })
      expectTypeOf<Effect.Effect.Error<typeof evaluation>>().toEqualTypeOf<never>()
      expectTypeOf<Effect.Effect.Context<typeof evaluation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const report = yield* evaluation.pipe(
        Effect.provideService(
          NativeModuleDependency,
          new NativeModuleDependencyValue({
            result: Effect.succeed({ answer: "answer" })
          })
        ),
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(report.successCount).toBe(1)
      expect(report.overallScores.exact).toBe(1)
    }))
})
