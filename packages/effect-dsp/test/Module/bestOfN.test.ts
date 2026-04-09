/**
 * Module.bestOfN contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FiberRef, Layer, Option, Ref } from "effect"
import { MetricResult } from "effect-dsp/contracts"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { RolloutRef } from "../../src/Cache/refs.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

describe("Module.bestOfN", () => {
  it.effect("returns the highest-scoring candidate across N rollouts", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Bad answer" },
          { answer: "Great answer" },
          { answer: "Okay answer" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = (_input, output) => {
        const scores: Record<string, number> = {
          "Bad answer": 0.2,
          "Great answer": 0.9,
          "Okay answer": 0.5
        }
        const score = scores[output.answer] ?? 0
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-best-of-3",
        module: inner,
        N: 3,
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
      const qa = yield* conciseFactsQaSignature
      const rolloutValues = yield* Ref.make<ReadonlyArray<Option.Option<number>>>([])
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((_prompt) =>
          FiberRef.get(RolloutRef).pipe(
            Effect.tap((rolloutValue) => Ref.update(rolloutValues, (entries) => [...entries, rolloutValue])),
            Effect.as({ answer: "Some answer" })
          )
        )
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-rollout-test",
        module: inner,
        N: 3,
        reward
      })

      yield* bestOf.forward({
        question: "Test question"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const observed = yield* Ref.get(rolloutValues)
      expect(observed).toHaveLength(3)
      expect(observed[0]).toEqual(Option.some(0))
      expect(observed[1]).toEqual(Option.some(1))
      expect(observed[2]).toEqual(Option.some(2))
    }))

  it.effect("applies threshold filtering — returns first candidate above threshold", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Low quality" },
          { answer: "High quality" },
          { answer: "Also high quality" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = (_input, output) => {
        const score = output.answer.includes("High") ? 0.8 : 0.2
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-threshold",
        module: inner,
        N: 3,
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
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Fair" },
          { answer: "Better" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = (_input, output) => {
        const score = output.answer === "Better" ? 0.4 : 0.2
        return Effect.succeed(new MetricResult({ score }))
      }

      const bestOf = yield* Module.bestOfN({
        name: "qa-fallback",
        module: inner,
        N: 2,
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
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "First" },
          { answer: "Second" },
          { answer: "Third" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-tiebreak",
        module: inner,
        N: 3,
        reward
      })

      const result = yield* bestOf.forward({
        question: "Tiebreak test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "First" })
    }))

  it.effect("records trace entries for each rollout when tracing is enabled", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "A" },
          { answer: "B" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof inner.signature.inputFields,
        typeof inner.signature.outputFields
      > = () => Effect.succeed(new MetricResult({ score: 0.5 }))

      const bestOf = yield* Module.bestOfN({
        name: "qa-traced",
        module: inner,
        N: 2,
        reward
      })

      const traced = yield* Trace.withTracing(
        bestOf.forward({ question: "Traced test" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const entries = traced[1]
      expect(entries).toHaveLength(2)
    }))
})
