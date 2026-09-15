/**
 * Module.refine contracts.
 */
import type * as AiError from "@effect/ai/AiError"
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import {
  MetricResult,
  moduleGraphLineage,
  ModuleId,
  RolloutCount,
  withModuleParamsInstructions
} from "@scenesystems/effect-dsp/contracts"
import type { DspError } from "@scenesystems/effect-dsp/Errors"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import {
  Array as Arr,
  Cause,
  Context,
  Deferred,
  Effect,
  Equal,
  Fiber,
  Layer,
  Match,
  Number as Num,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"

class RefineRewardRejected extends Schema.TaggedError<RefineRewardRejected>()(
  "RefineRewardRejected",
  { message: Schema.String }
) {}

class RefineRewardCalls extends Context.Tag("effect-dsp/test/refine/RewardCalls")<
  RefineRewardCalls,
  Ref.Ref<number>
>() {}

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

describe("Module.refine", () => {
  it.effect("discovers the executed wrapper, inner composition, and descendant", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("refine-discovery-predictor", signature)
      const inner = yield* Module.compose({
        name: "refine-discovery-pipeline",
        signature,
        subModules: Record.singleton("predictor", predictor),
        forward: ({ input }) => predictor.forward(input)
      })
      const wrapper = yield* Module.refine({
        name: "refine-discovery-wrapper",
        module: inner,
        N: RolloutCount.make(2),
        threshold: 0.9,
        reward: () => Effect.succeed(new MetricResult({ score: 1 }))
      })
      const wrapperId = yield* Schema.decodeUnknown(ModuleId)(wrapper.name)
      const innerId = yield* Schema.decodeUnknown(ModuleId)(inner.name)
      const predictorId = yield* Schema.decodeUnknown(ModuleId)(predictor.name)
      const model = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "Observed" }))

      const graph = yield* Module.discoverModuleGraph(
        wrapperId,
        wrapper.forward({ question: "Discover this execution" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, model.service)
        )
      )
      const lineage = yield* moduleGraphLineage(graph, predictorId)

      expect(lineage.path).toEqual(Arr.make(wrapperId, innerId, predictorId))
      expect(yield* Ref.get(model.calls)).toHaveLength(1)
    }))

  it.effect("loads the live inner graph and retains its loaded state after refinement", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("predictor", signature)
      yield* Ref.update(predictor.params, (params) => withModuleParamsInstructions(params, "Answer saved-city"))
      const inner = yield* Module.compose({
        name: "pipeline",
        signature,
        subModules: Record.singleton("predictor", predictor),
        forward: ({ input }) => predictor.forward(input)
      })
      const wrapper = yield* Module.refine({
        name: "refined-pipeline",
        module: inner,
        N: RolloutCount.make(2),
        threshold: 0.9,
        reward: () => Effect.succeed(new MetricResult({ score: 0.2, feedback: "Be precise" }))
      })
      const saved = yield* Module.save(wrapper)
      const original = yield* Ref.get(inner.params)
      yield* Ref.update(inner.params, (params) => withModuleParamsInstructions(params, "Changed pipeline"))
      yield* Ref.update(predictor.params, (params) => withModuleParamsInstructions(params, "Answer changed-city"))
      yield* Module.load(wrapper, saved)
      const model = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({
        answer: Match.value(Str.includes("Answer saved-city")(prompt)).pipe(
          Match.when(true, () => "saved-city"),
          Match.orElse(() => "changed-city")
        )
      })))
      const result = yield* wrapper.forward({ question: "Which city?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      expect(result.answer).toBe("saved-city")
      expect(yield* Ref.get(inner.params)).toEqual(original)
      expect(yield* Ref.get(model.calls)).toHaveLength(2)
    }))

  it.effect("rejects a wrapper identity that collides with the inner owner", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const inner = yield* Module.predict("same-owner", signature)
      const error = yield* Module.refine({
        name: "same-owner",
        module: inner,
        N: RolloutCount.make(1),
        threshold: 0.9,
        reward: () => Effect.succeed(new MetricResult({ score: 1 }))
      }).pipe(Effect.flip)
      expect(error._tag).toBe("CompositionError")
    }))

  it.effect("restores params while preserving reward service and checked failure channels", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Needs feedback" },
          { answer: "Fails scoring" }
        ))
      )
      const inner = yield* Module.predict("qa-refine-reward-channels", qa)
      const baseParams = yield* Ref.get(inner.params)
      const rewardCalls = yield* Ref.make(0)
      const failure = new RefineRewardRejected({ message: "reward rejected" })
      const refined = yield* Module.refine({
        name: "qa-refine-reward-wrapper",
        module: inner,
        N: RolloutCount.make(2),
        reward: () =>
          Effect.flatMap(RefineRewardCalls, (calls) =>
            Ref.getAndUpdate(calls, Num.increment).pipe(
              Effect.flatMap((call) =>
                Match.value(call).pipe(
                  Match.when(0, () => Effect.succeed(new MetricResult({ score: 0.2, feedback: "Try again" }))),
                  Match.orElse(() => Effect.fail(failure))
                )
              )
            )),
        threshold: 0.9
      })
      const operation = refined.forward({ question: "Refine this" })

      expectTypeOf<Effect.Effect.Error<typeof operation>>().toEqualTypeOf<
        AiError.AiError | DspError | RefineRewardRejected
      >()
      expectTypeOf<Effect.Effect.Context<typeof operation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | RefineRewardCalls
      >()

      const observed = yield* operation.pipe(
        Effect.provideService(RefineRewardCalls, rewardCalls),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const restoredParams = yield* Ref.get(inner.params)

      expect(Cause.originalError(observed)).toBe(failure)
      expect(restoredParams).toEqual(baseParams)
    }))

  it.effect("feedback from attempt N appears in the prompt for attempt N+1", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "First attempt" },
          { answer: "Second attempt" },
          { answer: "Third attempt" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(output.answer).pipe(
          Match.when("First attempt", () => 0.3),
          Match.when("Second attempt", () => 0.5),
          Match.when("Third attempt", () => 0.9),
          Match.orElse(() => 0)
        )
        return Effect.succeed(
          new MetricResult({
            score,
            feedback: "The answer needs improvement"
          })
        )
      }

      const refined = yield* Module.refine({
        name: "qa-refine",
        module: inner,
        N: RolloutCount.make(3),
        reward,
        threshold: 0.8
      })

      yield* refined.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)
      const secondCall = yield* Arr.get(calls, 1)
      const thirdCall = yield* Arr.get(calls, 2)
      expect(calls).toHaveLength(3)
      expect(secondCall.prompt).toContain("Refinement feedback")
      expect(secondCall.prompt).toContain("Attempt 1")
      expect(thirdCall.prompt).toContain("Attempt 1")
      expect(thirdCall.prompt).toContain("Attempt 2")
    }))

  it.effect("stops early when a candidate meets the threshold", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Poor" },
          { answer: "Excellent" },
          { answer: "Should not reach" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(Equal.equals(output.answer, "Excellent")).pipe(
          Match.when(true, () => 0.95),
          Match.orElse(() => 0.3)
        )
        return Effect.succeed(new MetricResult({ score }))
      }

      const refined = yield* Module.refine({
        name: "qa-early-stop",
        module: inner,
        N: RolloutCount.make(5),
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
        MockLanguageModel.sequence(Arr.make(
          { answer: "Attempt 1" },
          { answer: "Attempt 2" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new MetricResult({ score: 0.3 }))

      const refined = yield* Module.refine({
        name: "qa-traced-refine",
        module: inner,
        N: RolloutCount.make(2),
        reward,
        threshold: 0.9
      })

      const traced = yield* Trace.withTracing(
        refined.forward({ question: "Trace test" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const entries = yield* Arr.get(traced, 1)
      expect(entries).toHaveLength(2)
    }))

  it.effect("restores base params after refinement to prevent cross-call drift", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Run 1 attempt 1" },
          { answer: "Run 1 attempt 2" },
          { answer: "Run 2 attempt 1" },
          { answer: "Run 2 attempt 2" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)
      const baseParams = yield* Ref.get(inner.params)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new MetricResult({ score: 0.3 }))

      const refined = yield* Module.refine({
        name: "qa-drift-test",
        module: inner,
        N: RolloutCount.make(2),
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
        MockLanguageModel.sequence(Arr.make(
          { answer: "First attempt" },
          { answer: "Second attempt" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)
      const baseParams = yield* Ref.get(inner.params)
      const rewardCalls = yield* Ref.make(0)
      const secondRewardStarted = yield* Deferred.make<void>()

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () =>
        Ref.getAndUpdate(rewardCalls, Num.increment).pipe(
          Effect.flatMap((call) =>
            Match.value(call).pipe(
              Match.when(0, () => Effect.succeed(new MetricResult({ score: 0.2, feedback: "Try again" }))),
              Match.orElse(() =>
                Deferred.succeed(secondRewardStarted, undefined).pipe(
                  Effect.zipRight(Effect.never)
                )
              )
            )
          )
        )

      const refined = yield* Module.refine({
        name: "qa-interrupted-refine",
        module: inner,
        N: RolloutCount.make(2),
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
        MockLanguageModel.sequence(Arr.make(
          { answer: "First" },
          { answer: "Second" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)
      const activeRewards = yield* Ref.make(0)
      const maximumActiveRewards = yield* Ref.make(0)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () =>
        Effect.acquireUseRelease(
          Ref.updateAndGet(activeRewards, Num.increment).pipe(
            Effect.tap((count) => Ref.update(maximumActiveRewards, Num.max(count)))
          ),
          () =>
            Effect.yieldNow().pipe(
              Effect.as(new MetricResult({ score: 1 }))
            ),
          () => Ref.update(activeRewards, Num.decrement)
        )

      const refined = yield* Module.refine({
        name: "qa-serialized-refine",
        module: inner,
        N: RolloutCount.make(1),
        reward,
        threshold: 0.9
      })
      const modelLayer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      yield* Effect.all(
        Arr.make(
          refined.forward({ question: "First call" }),
          refined.forward({ question: "Second call" })
        ),
        { concurrency: "unbounded" }
      ).pipe(Effect.provide(modelLayer))

      expect(yield* Ref.get(maximumActiveRewards)).toBe(1)
    }))

  it.effect("returns best output across all attempts when threshold is never met", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          { answer: "Weak" },
          { answer: "Better" },
          { answer: "Best so far" }
        ))
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = (_input, output) => {
        const score = Match.value(output.answer).pipe(
          Match.when("Weak", () => 0.2),
          Match.when("Better", () => 0.5),
          Match.when("Best so far", () => 0.7),
          Match.orElse(() => 0)
        )
        return Effect.succeed(new MetricResult({ score }))
      }

      const refined = yield* Module.refine({
        name: "qa-best-overall",
        module: inner,
        N: RolloutCount.make(3),
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

  it.effect("does not let a NaN score replace a valid score before a better attempt", () =>
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

      const refined = yield* Module.refine({
        name: "qa-nan-between-valid-scores",
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
          ),
        threshold: 0.9
      })

      const result = yield* refined.forward({ question: "NaN candidate" }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "Better last" })
      expect(yield* Ref.get(mock.calls)).toHaveLength(3)
    }))

  it.effect("returns the first output when every score is NaN", () =>
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

      const refined = yield* Module.refine({
        name: "qa-nan-scores",
        module: inner,
        N: RolloutCount.make(2),
        reward: () => Effect.succeed(new MetricResult({ score: nan })),
        threshold: 0.5
      })

      const result = yield* refined.forward({
        question: "NaN scores"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      expect(result).toEqual({ answer: "First" })
      expect(yield* Ref.get(mock.calls)).toHaveLength(1)
    }))

  it.effect("rejects a non-positive attempt count at the RolloutCount boundary", () =>
    Effect.gen(function*() {
      const zero = yield* Schema.decodeUnknown(RolloutCount)(0).pipe(Effect.flip)
      const fractional = yield* Schema.decodeUnknown(RolloutCount)(1.5).pipe(Effect.flip)

      expect(zero._tag).toBe("ParseError")
      expect(fractional._tag).toBe("ParseError")
    }))
})
