/**
 * Module.refine contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { MetricResult } from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Deferred, Effect, Fiber, Layer, Ref, Schema } from "effect"

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

describe("Module.refine", () => {
  it.effect("feedback from attempt N appears in the prompt for attempt N+1", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "First attempt" },
          { answer: "Second attempt" },
          { answer: "Third attempt" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = (_input, output) => {
        const scores: Record<string, number> = {
          "First attempt": 0.3,
          "Second attempt": 0.5,
          "Third attempt": 0.9
        }
        const score = scores[output.answer] ?? 0
        return Effect.succeed(
          new MetricResult({
            score,
            feedback: `Score was ${score}, needs improvement`
          })
        )
      }

      const refined = yield* Module.refine({
        name: "qa-refine",
        module: inner,
        N: 3,
        reward,
        threshold: 0.8
      })

      yield* refined.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)
      expect(calls).toHaveLength(3)
      expect(calls[1]?.prompt).toContain("Refinement feedback")
      expect(calls[1]?.prompt).toContain("Attempt 1")
      expect(calls[2]?.prompt).toContain("Attempt 1")
      expect(calls[2]?.prompt).toContain("Attempt 2")
    }))

  it.effect("stops early when a candidate meets the threshold", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Poor" },
          { answer: "Excellent" },
          { answer: "Should not reach" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = (_input, output) => {
        const score = output.answer === "Excellent" ? 0.95 : 0.3
        return Effect.succeed(new MetricResult({ score }))
      }

      const refined = yield* Module.refine({
        name: "qa-early-stop",
        module: inner,
        N: 5,
        reward,
        threshold: 0.9
      })

      const result = yield* refined.forward({
        question: "Early stop test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)
      expect(result).toEqual({ answer: "Excellent" })
      expect(calls).toHaveLength(2)
    }))

  it.effect("records trace entries for each refinement attempt", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Attempt 1" },
          { answer: "Attempt 2" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = () => Effect.succeed(new MetricResult({ score: 0.3 }))

      const refined = yield* Module.refine({
        name: "qa-traced-refine",
        module: inner,
        N: 2,
        reward,
        threshold: 0.9
      })

      const traced = yield* Trace.withTracing(
        refined.forward({ question: "Trace test" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const entries = traced[1]
      expect(entries).toHaveLength(2)
    }))

  it.effect("restores base params after refinement to prevent cross-call drift", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Run 1 attempt 1" },
          { answer: "Run 1 attempt 2" },
          { answer: "Run 2 attempt 1" },
          { answer: "Run 2 attempt 2" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)
      const baseParams = yield* Ref.get(inner.params)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = () => Effect.succeed(new MetricResult({ score: 0.3 }))

      const refined = yield* Module.refine({
        name: "qa-drift-test",
        module: inner,
        N: 2,
        reward,
        threshold: 0.9
      })

      yield* refined.forward({ question: "First call" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const paramsAfterFirst = yield* Ref.get(inner.params)
      expect(paramsAfterFirst.instructions).toBe(baseParams.instructions)

      yield* refined.forward({ question: "Second call" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const paramsAfterSecond = yield* Ref.get(inner.params)
      expect(paramsAfterSecond.instructions).toBe(baseParams.instructions)
    }))

  it.effect("restores base params when refinement is interrupted", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "First attempt" },
          { answer: "Second attempt" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)
      const baseParams = yield* Ref.get(inner.params)
      const rewardCalls = yield* Ref.make(0)
      const secondRewardStarted = yield* Deferred.make<void>()

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = () =>
        Ref.getAndUpdate(rewardCalls, (count) => count + 1).pipe(
          Effect.flatMap((call) =>
            call === 0
              ? Effect.succeed(new MetricResult({ score: 0.2, feedback: "Try again" }))
              : Deferred.succeed(secondRewardStarted, undefined).pipe(
                Effect.zipRight(Effect.never)
              )
          )
        )

      const refined = yield* Module.refine({
        name: "qa-interrupted-refine",
        module: inner,
        N: 2,
        reward,
        threshold: 0.9
      })

      const fiber = yield* refined.forward({ question: "Interrupt test" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service)),
        Effect.fork
      )

      yield* Deferred.await(secondRewardStarted)
      yield* Fiber.interrupt(fiber)

      const paramsAfterInterruption = yield* Ref.get(inner.params)
      expect(paramsAfterInterruption).toEqual(baseParams)
    }))

  it.effect("serializes concurrent calls through the same wrapper", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "First" },
          { answer: "Second" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)
      const activeRewards = yield* Ref.make(0)
      const maximumActiveRewards = yield* Ref.make(0)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = () =>
        Effect.acquireUseRelease(
          Ref.updateAndGet(activeRewards, (count) => count + 1).pipe(
            Effect.tap((count) => Ref.update(maximumActiveRewards, (maximum) => Math.max(maximum, count)))
          ),
          () =>
            Effect.yieldNow().pipe(
              Effect.as(new MetricResult({ score: 1 }))
            ),
          () => Ref.update(activeRewards, (count) => count - 1)
        )

      const refined = yield* Module.refine({
        name: "qa-serialized-refine",
        module: inner,
        N: 1,
        reward,
        threshold: 0.9
      })
      const modelLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      yield* Effect.all([
        refined.forward({ question: "First call" }),
        refined.forward({ question: "Second call" })
      ], { concurrency: "unbounded" }).pipe(Effect.provide(modelLayer))

      expect(yield* Ref.get(maximumActiveRewards)).toBe(1)
    }))

  it.effect("returns best output across all attempts when threshold is never met", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          { answer: "Weak" },
          { answer: "Better" },
          { answer: "Best so far" }
        ])
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        { readonly question: typeof Schema.String },
        { readonly answer: typeof Schema.String }
      > = (_input, output) => {
        const scores: Record<string, number> = {
          "Weak": 0.2,
          "Better": 0.5,
          "Best so far": 0.7
        }
        const score = scores[output.answer] ?? 0
        return Effect.succeed(new MetricResult({ score }))
      }

      const refined = yield* Module.refine({
        name: "qa-best-overall",
        module: inner,
        N: 3,
        reward,
        threshold: 0.95
      })

      const result = yield* refined.forward({
        question: "Best overall test"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "Best so far" })
    }))
})
