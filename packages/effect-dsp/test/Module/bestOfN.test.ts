/**
 * Module.bestOfN contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { MetricResult, RolloutCount } from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Equal, FiberRef, Layer, Match, Option, Ref, Schema, String as Str } from "effect"
import { RolloutRef } from "../../src/Cache/refs.js"

const QaInput = Schema.Struct({
  question: Signature.describe(Schema.String, "The question to answer")
})

const QaOutput = Schema.Struct({
  answer: Signature.describe(Schema.String, "A concise factual answer")
})

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    QaInput.fields,
    QaOutput.fields
  )

describe("Module.bestOfN", () => {
  it.effect("returns the highest-scoring candidate across N rollouts", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Bad answer" },
          { answer: "Great answer" },
          { answer: "Okay answer" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(output.answer).pipe(
          Match.when("Bad answer", () => 0.2),
          Match.when("Great answer", () => 0.9),
          Match.when("Okay answer", () => 0.5),
          Match.orElse(() => 0)
        )
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-best-of-3",
        module: inner,
        N: RolloutCount.make(3),
        reward
      })

      const result = yield* bestOf.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "Great answer" })
    }))

  it.effect("each rollout receives a distinct RolloutRef value", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const rolloutValues = yield* Ref.make(Arr.empty<Option.Option<number>>())
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((_prompt) =>
          FiberRef.get(RolloutRef).pipe(
            Effect.tap((rolloutValue) => Ref.update(rolloutValues, Arr.append(rolloutValue))),
            Effect.as({ answer: "Some answer" })
          )
        )
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-rollout-test",
        module: inner,
        N: RolloutCount.make(3),
        reward
      })

      yield* bestOf.forward({
        question: "Test question"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const observed = yield* Ref.get(rolloutValues)
      const first = yield* Arr.get(observed, 0)
      const second = yield* Arr.get(observed, 1)
      const third = yield* Arr.get(observed, 2)
      expect(observed).toHaveLength(3)
      expect(first).toEqual(Option.some(0))
      expect(second).toEqual(Option.some(1))
      expect(third).toEqual(Option.some(2))
    }))

  it.effect("applies threshold filtering — returns first candidate above threshold", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Low quality" },
          { answer: "High quality" },
          { answer: "Also high quality" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(Str.includes("High")(output.answer)).pipe(
          Match.when(true, () => 0.8),
          Match.orElse(() => 0.2)
        )
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-threshold",
        module: inner,
        N: RolloutCount.make(3),
        reward,
        threshold: 0.7
      })

      const result = yield* bestOf.forward({
        question: "Threshold test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "High quality" })
    }))

  it.effect("returns best candidate when none meet threshold", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Fair" },
          { answer: "Better" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(Equal.equals(output.answer, "Better")).pipe(
          Match.when(true, () => 0.4),
          Match.orElse(() => 0.2)
        )
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-fallback",
        module: inner,
        N: RolloutCount.make(2),
        reward,
        threshold: 0.9
      })

      const result = yield* bestOf.forward({
        question: "Fallback test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "Better" })
    }))

  it.effect("stable tie-break: lowest rollout index wins when scores are equal", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "First" },
          { answer: "Second" },
          { answer: "Third" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-tiebreak",
        module: inner,
        N: RolloutCount.make(3),
        reward
      })

      const result = yield* bestOf.forward({
        question: "Tiebreak test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "First" })
    }))

  it.effect("ignores NaN between valid candidates and returns the better valid score", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Valid first" },
          { answer: "NaN candidate" },
          { answer: "Better last" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)
      const nan = yield* Schema.decode(Schema.NumberFromString)("NaN")

      const bestOf = yield* Module.bestOfN({
        name: "qa-best-of-nan-between-valid-scores",
        module: inner,
        N: RolloutCount.make(3),
        reward: (_input, output) =>
          Effect.succeed(
            new MetricResult({
              score: Match.value(output.answer).pipe(
                Match.when("Valid first", () => 0.4),
                Match.when("Better last", () => 0.8),
                Match.orElse(() => nan)
              )
            })
          )
      })

      const result = yield* bestOf.forward({ question: "NaN candidate" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "Better last" })
    }))

  it.effect("returns the first output when every rollout score is NaN", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "First" },
          { answer: "Second" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)
      const nan = yield* Schema.decode(Schema.NumberFromString)("NaN")

      const bestOf = yield* Module.bestOfN({
        name: "qa-best-of-all-nan",
        module: inner,
        N: RolloutCount.make(2),
        reward: () => Effect.succeed(new MetricResult({ score: nan }))
      })

      const result = yield* bestOf.forward({ question: "All NaN scores" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "First" })
      expect(yield* Ref.get(mock.calls)).toHaveLength(2)
    }))

  it.effect("records trace entries for each rollout when tracing is enabled", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "A" },
          { answer: "B" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-traced",
        module: inner,
        N: RolloutCount.make(2),
        reward
      })

      const traced = yield* Trace.withTracing(
        bestOf.forward({ question: "Traced test" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const entries = yield* Arr.get(traced, 1)
      expect(entries).toHaveLength(2)
    }))
})
