/**
 * Metrics consume the decoded output schema, including transformations.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Context, Effect, Number, Record, Ref, Schema } from "effect"

const Output = Schema.Struct({ result: Schema.Struct({ count: Schema.NumberFromString }) })

class Scale extends Context.Tag("effect-dsp/test/MetricScale")<Scale, number>() {}

class ScoringFailed extends Schema.TaggedError<ScoringFailed>()("ScoringFailed", { message: Schema.String }) {}

const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make("Count", { question: Schema.String }, Output.fields)
  return yield* Module.compose({
    name: "counter",
    signature,
    subModules: Record.empty(),
    forward: () => Schema.decode(Output)({ result: { count: "7" } })
  })
})

describe("schema-derived metric values", () => {
  it.effect("preserves structured decoded values and scorer services through composition and evaluation", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("unused"))
      const observed = yield* Ref.make(Arr.empty<number>())
      const difference = Metric.fromEffect(
        "difference",
        (prediction: typeof Output.Type, expected) =>
          Effect.gen(function*() {
            expectTypeOf(expected).toEqualTypeOf<typeof Output.Type>()
            yield* Ref.set(observed, Arr.make(prediction.result.count, expected.result.count))
            const scale = yield* Scale
            return new Metric.Result({
              score: Number.multiply(Number.subtract(prediction.result.count, expected.result.count), scale)
            })
          })
      )
      const metric = Metric.compose({ difference })
      const evaluation = Evaluate.run({
        module,
        examples: Arr.make(new Example({ input: { question: "How many?" }, output: { result: { count: "3" } } })),
        metrics: { metric }
      })
      expectTypeOf<Effect.Effect.Context<typeof evaluation>>().toEqualTypeOf<LanguageModel.LanguageModel | Scale>()
      const report = yield* evaluation.pipe(
        Effect.provideService(Scale, 2),
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(yield* Ref.get(observed)).toEqual(Arr.make(7, 3))
      expect(report.successCount).toBe(1)
      expect(report.overallScores.metric).toBe(8)
    }))

  it.effect("reports malformed expected values before invoking the model or scorer", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Count", { question: Schema.String }, Output.fields)
      const module = yield* Module.predict("invalid-label", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ result: { count: "7" } }))
      const calls = yield* Ref.make(0)
      const metric = Metric.fromEffect("count", (_prediction: typeof Output.Type) =>
        Ref.update(calls, Number.increment).pipe(Effect.as(new Metric.Result({ score: 1 }))))
      const report = yield* Evaluate.run({
        module,
        examples: Arr.make(new Example({ input: { question: "How many?" }, output: { result: { count: "invalid" } } })),
        metrics: { metric }
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect(yield* Ref.get(calls)).toBe(0)
      expect(yield* Ref.get(mock.calls)).toEqual(Arr.empty())
      expect(report.failureCount).toBe(1)
      const failure = yield* Arr.head(report.failures)
      expect(failure.tag).toBe("EvaluationFailed")
      expect(failure.message).toBe("expected output does not match module output schema")
    }))

  it.effect("retains typed scorer failures and captures them as failed evaluations", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("unused"))
      const metric = Metric.fromEffect("checked", (_prediction: typeof Output.Type) =>
        Effect.fail(new ScoringFailed({ message: "judge unavailable" })))
      const scoring = metric.score({ result: { count: 7 } }, { result: { count: 3 } })
      expectTypeOf<Effect.Effect.Error<typeof scoring>>().toEqualTypeOf<ScoringFailed>()
      expect(yield* Effect.flip(scoring)).toBeInstanceOf(ScoringFailed)
      const report = yield* Evaluate.run({
        module,
        examples: Arr.make(new Example({ input: { question: "How many?" }, output: { result: { count: "3" } } })),
        metrics: { metric }
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect(report.failureCount).toBe(1)
      const failure = yield* Arr.head(report.failures)
      expect(failure.tag).toBe("ScoringFailed")
      expect(failure.message).toBe("judge unavailable")
    }))
})
