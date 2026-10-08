/**
 * Metrics consume the decoded output schema, including transformations.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Context, Effect, Number, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import type { Error as EffectError, Services } from "effect/Effect"
import { score } from "../kit/Metric.js"

const Output = Schema.Struct({ result: Schema.Struct({ count: Schema.FiniteFromString }) })

class Scale extends Context.Service<Scale, number>()("effect-dsp/test/MetricScale") {}

class ScoringFailed extends Schema.TaggedError<ScoringFailed>()("ScoringFailed", { message: Schema.String }) {}

const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make("Count", { question: Schema.String }, Output.fields)
  return yield* Module.compose(
    new Module.ComposeOptions({
      name: "counter",
      signature,
      subModules: Record.empty(),
      forward: () => Schema.decodeEffect(Output)({ result: { count: "7" } })
    })
  )
})

describe("schema-derived metric values", () => {
  it.effect("preserves structured decoded values and scorer services through composition and evaluation", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("unused"))
      const observed = yield* Ref.make(Arr.empty<number>())
      const difference = Metric.withFeedback(
        (example, prediction) =>
          Effect.gen(function*() {
            const output = yield* Schema.decodeUnknownEffect(Schema.toType(Output))(prediction.output)
            const expected = yield* Schema.decodeUnknownEffect(Schema.Struct({ target: Schema.Finite }))(
              Option.getOrElse(example.labels, Record.empty)
            )
            yield* Ref.set(observed, Arr.make(output.result.count, expected.target))
            const scale = yield* Scale
            return new Metric.Score({
              value: Number.multiply(Number.subtract(output.result.count, expected.target), scale),
              feedback: Option.none()
            })
          }),
        "difference"
      )
      const metric = Metric.compose({ difference })
      const evaluation = Evaluate.run(
        new Evaluate.Options({
          module,
          examples: Arr.make(new Example({ input: { question: "How many?" }, labels: Option.some({ target: 3 }) })),
          metrics: { metric }
        })
      )
      expectTypeOf<Services<typeof evaluation>>().toEqualTypeOf<LanguageModel.LanguageModel | Scale>()
      const report = yield* evaluation.pipe(
        Effect.provideService(Scale, 2),
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect(yield* Ref.get(observed)).toEqual(Arr.make(7, 3))
      expect(report.successCount).toBe(1)
      expect(report.overallScores.metric).toBe(8)
    }))

  it.effect("passes labels outside the output schema to the scorer unchanged", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Count", { question: Schema.String }, Output.fields)
      const module = yield* Module.predict("invalid-label", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ result: { count: "7" } }))
      const calls = yield* Ref.make(0)
      const metric = Metric.withFeedback((example) =>
        Effect.gen(function*() {
          yield* Ref.update(calls, Number.increment)
          expect(example.labels).toEqual(Option.some({ result: { count: "invalid" } }))
          return new Metric.Score({ value: 1, feedback: Option.none() })
        }), "count")
      const report = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: Arr.make(
            new Example({ input: { question: "How many?" }, labels: Option.some({ result: { count: "invalid" } }) })
          ),
          metrics: { metric }
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect(yield* Ref.get(calls)).toBe(1)
      expect(yield* Ref.get(mock.calls)).toHaveLength(1)
      expect(report.failureCount).toBe(0)
      expect(report.overallScores.metric).toBe(1)
    }))

  it.effect("retains typed scorer failures and captures them as failed evaluations", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("unused"))
      const metric = Metric.withFeedback(
        () => Effect.fail(new ScoringFailed({ message: "judge unavailable" })),
        "checked"
      )
      const scoring = score(metric, { result: { count: "3" } }, { result: { count: 7 } })
      expectTypeOf<EffectError<typeof scoring>>().toEqualTypeOf<ScoringFailed>()
      expect(yield* Effect.flip(scoring)).toBeInstanceOf(ScoringFailed)
      const report = yield* Evaluate.run(
        new Evaluate.Options({
          module,
          examples: Arr.make(
            new Example({ input: { question: "How many?" }, labels: Option.some({ result: { count: "3" } }) })
          ),
          metrics: { metric }
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect(report.failureCount).toBe(1)
      const failure = Option.getOrThrow(Arr.head(report.failures))
      expect(failure.tag).toBe("ScoringFailed")
      expect(failure.message).toBe("judge unavailable")
    }))
})
