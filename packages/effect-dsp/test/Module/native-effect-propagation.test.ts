/**
 * Native module failures and requirements remain visible through consumers.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import type { DspError } from "@scenesystems/effect-dsp/DspError"
import * as Ensemble from "@scenesystems/effect-dsp/Ensemble"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Context, Data, Effect, Inspectable, Option, Record, Schema, String } from "effect"
import type * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"

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

class NativeModuleDependency extends Context.Service<NativeModuleDependency, NativeModuleDependencyValue>()(
  "effect-dsp/test/NativeModuleDependency"
) {}

const makeSignature = () =>
  Signature.make(
    "Propagate native module effects",
    NativeModuleInput.fields,
    NativeModuleOutput.fields
  )

const makeNativeModule = Effect.gen(function*() {
  const signature = yield* makeSignature()

  return yield* Module.compose(
    new Module.ComposeOptions({
      name: "native-module",
      signature,
      subModules: Record.empty(),
      forward: () =>
        Effect.flatMap(
          NativeModuleDependency,
          (dependency) => dependency.result
        )
    })
  )
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
      const ensemble = yield* Ensemble.make(new Ensemble.Options({ programs }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("unused"))
      const result = yield* ensemble.forward({ question: "Which cities?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(result.answer.cities).toEqual(Arr.make("Paris", "Tokyo"))
    }))

  it.effect("preserves native channels through compose and bestOfN", () =>
    Effect.gen(function*() {
      const nativeModule = yield* makeNativeModule
      const nativeOperation = nativeModule.forward({ question: "question" })
      expectTypeOf<Effect.Error<typeof nativeOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Services<typeof nativeOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "unused" }))
      const wrapped = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "native-best-of-n",
          module: nativeModule,
          N: Module.RolloutCount.make(1),
          reward: () => Effect.succeed(new Metric.Score({ value: 1, feedback: Option.none() }))
        })
      )
      const wrappedOperation = wrapped.forward({ question: "question" })
      expectTypeOf<Effect.Error<typeof wrappedOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Services<typeof wrappedOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const failure = yield* wrappedOperation.pipe(
        Effect.provideService(
          NativeModuleDependency,
          new NativeModuleDependencyValue({
            result: Effect.fail(new NativeModuleFailure({ message: "native failure" }))
          })
        ),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toBeInstanceOf(NativeModuleFailure)
      expect(failure.message).toBe("native failure")
    }))

  it.effect("uses native requirements through refine and evaluation", () =>
    Effect.gen(function*() {
      const nativeModule = yield* makeNativeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "unused" }))
      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "native-refine",
          module: nativeModule,
          N: Module.RolloutCount.make(1),
          reward: () => Effect.succeed(new Metric.Score({ value: 1, feedback: Option.none() })),
          threshold: 1
        })
      )
      const refinedOperation = refined.forward({ question: "question" })
      expectTypeOf<Effect.Error<typeof refinedOperation>>().toEqualTypeOf<
        AiError.AiError | DspError | NativeModuleFailure
      >()
      expectTypeOf<Effect.Services<typeof refinedOperation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const metric = Metric.exactMatch("answer")
      const evaluation = Evaluate.run(
        new Evaluate.Options({
          module: refined,
          examples: Arr.make(
            new Example({ input: { question: "question" }, labels: Option.some({ answer: "answer" }) })
          ),
          metrics: { exact: metric }
        })
      )
      expectTypeOf<Effect.Error<typeof evaluation>>().toEqualTypeOf<never>()
      expectTypeOf<Effect.Services<typeof evaluation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | NativeModuleDependency
      >()
      const report = yield* evaluation.pipe(
        Effect.provideService(
          NativeModuleDependency,
          new NativeModuleDependencyValue({
            result: Effect.succeed({ answer: "answer" })
          })
        ),
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(report.successCount).toBe(1)
      expect(report.overallScores.exact).toBe(1)
    }))
})
