/**
 * Module.refine contracts.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import type { DspError } from "@scenesystems/effect-dsp/DspError"
import { Score } from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as ModuleGraph from "@scenesystems/effect-dsp/ModuleGraph"
import { withInstructions } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import {
  Array as Arr,
  Boolean,
  Context,
  Deferred,
  Effect,
  Equal,
  Fiber,
  Layer,
  Match,
  Number as Num,
  Option,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"
import type * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"

class RefineRewardRejected extends Schema.TaggedError<RefineRewardRejected>()(
  "RefineRewardRejected",
  { message: Schema.String }
) {}

class RefineRewardCalls extends Context.Service<RefineRewardCalls, Ref.Ref<number>>()(
  "effect-dsp/test/refine/RewardCalls"
) {}

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
  it.effect("applies retry feedback to every composed leaf without changing the base", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const first = yield* Module.predict("first", signature)
      const second = yield* Module.predict("second", signature)
      const inner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: { first, second },
          forward: ({ input }) => first.forward(input).pipe(Effect.andThen(second.forward(input)))
        })
      )
      const before = yield* Module.save(inner)
      const wrapper = yield* Module.refine(
        new Module.RefineOptions({
          name: "refined",
          module: inner,
          N: Module.RolloutCount.make(2),
          threshold: 1,
          reward: () => Effect.succeed(new Score({ value: 0, feedback: Option.some("Verify each claim") }))
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      yield* wrapper.forward({ question: "Question" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const calls = yield* Ref.get(mock.calls)
      expect(calls).toHaveLength(4)
      yield* Effect.forEach(Arr.take(calls, 2), (call) =>
        Effect.sync(() => expect(call.prompt).not.toContain("Verify each claim")))
      yield* Effect.forEach(Arr.drop(calls, 2), (call) =>
        Effect.sync(() =>
          expect(call.prompt).toContain("Verify each claim")
        ))
      expect(yield* Module.save(inner)).toEqual(before)
    }))

  it.effect("discovers the executed wrapper, inner composition, and descendant", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("refine-discovery-predictor", signature)
      const inner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "refine-discovery-pipeline",
          signature,
          subModules: Record.singleton("predictor", predictor),
          forward: ({ input }) => predictor.forward(input)
        })
      )
      const wrapper = yield* Module.refine(
        new Module.RefineOptions({
          name: "refine-discovery-wrapper",
          module: inner,
          N: Module.RolloutCount.make(2),
          threshold: 0.9,
          reward: () => Effect.succeed(new Score({ value: 1, feedback: Option.none() }))
        })
      )
      const wrapperId = yield* Schema.decodeEffect(Module.Id)(wrapper.name)
      const innerId = yield* Schema.decodeEffect(Module.Id)(inner.name)
      const predictorId = yield* Schema.decodeEffect(Module.Id)(predictor.name)
      const model = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Observed" }))

      const graph = yield* Module.discoverModuleGraph(
        wrapperId,
        wrapper.forward({ question: "Discover this execution" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, model.service)
        )
      )
      const lineage = Option.getOrThrow(ModuleGraph.lineage(graph, predictorId))

      expect(lineage.path).toEqual(Arr.make(wrapperId, innerId, predictorId))
      expect(yield* Ref.get(model.calls)).toHaveLength(1)
    }))

  it.effect("loads the live inner graph and retains its loaded state after refinement", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("predictor", signature)
      yield* Ref.update(predictor.params, (params) => withInstructions(params, "Answer saved-city"))
      const inner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: Record.singleton("predictor", predictor),
          forward: ({ input }) => predictor.forward(input)
        })
      )
      const wrapper = yield* Module.refine(
        new Module.RefineOptions({
          name: "refined-pipeline",
          module: inner,
          N: Module.RolloutCount.make(2),
          threshold: 0.9,
          reward: () => Effect.succeed(new Score({ value: 0.2, feedback: Option.some("Be precise") }))
        })
      )
      const saved = yield* Module.save(wrapper)
      yield* Ref.update(inner.params, (params) => withInstructions(params, "Changed pipeline"))
      yield* Ref.update(predictor.params, (params) => withInstructions(params, "Answer changed-city"))
      yield* Module.load(wrapper, saved)
      const model = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => ({
        answer: Boolean.match(Str.includes("Answer saved-city")(prompt), {
          onTrue: () => "saved-city",
          onFalse: () => "changed-city"
        })
      })))
      const result = yield* wrapper.forward({ question: "Which city?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, model.service)
      )
      expect(result.answer).toBe("saved-city")
      expect((yield* Ref.get(inner.params)).instructions).toBe("Changed pipeline")
      expect(yield* Ref.get(model.calls)).toHaveLength(2)
    }))

  it.effect("rejects a wrapper identity that collides with the inner owner", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const inner = yield* Module.predict("same-owner", signature)
      const error = yield* Module.refine(
        new Module.RefineOptions({
          name: "same-owner",
          module: inner,
          N: Module.RolloutCount.make(1),
          threshold: 0.9,
          reward: () => Effect.succeed(new Score({ value: 1, feedback: Option.none() }))
        })
      ).pipe(Effect.flip)
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
      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-refine-reward-wrapper",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward: () =>
            Effect.flatMap(RefineRewardCalls, (calls) =>
              Ref.getAndUpdate(calls, Num.increment).pipe(
                Effect.flatMap((call) =>
                  Match.value(call).pipe(
                    Match.when(0, () => Effect.succeed(new Score({ value: 0.2, feedback: Option.some("Try again") }))),
                    Match.orElse(() => Effect.fail(failure))
                  )
                )
              )),
          threshold: 0.9
        })
      )
      const operation = refined.forward({ question: "Refine this" })

      expectTypeOf<Effect.Error<typeof operation>>().toEqualTypeOf<
        AiError.AiError | DspError | RefineRewardRejected
      >()
      expectTypeOf<Effect.Services<typeof operation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | RefineRewardCalls
      >()

      const observed = yield* operation.pipe(
        Effect.provideService(RefineRewardCalls, rewardCalls),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const restoredParams = yield* Ref.get(inner.params)

      expect(observed).toBe(failure)
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
          new Score({
            value: score,
            feedback: Option.some("The answer needs improvement")
          })
        )
      }

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-refine",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward,
          threshold: 0.8
        })
      )

      yield* refined.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      const calls = yield* Ref.get(mock.calls)
      const secondCall = Option.getOrThrow(Arr.get(calls, 1))
      const thirdCall = Option.getOrThrow(Arr.get(calls, 2))
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
        const score = Boolean.match(Equal.equals(output.answer, "Excellent"), {
          onTrue: () => 0.95,
          onFalse: () => 0.3
        })
        return Effect.succeed(new Score({ value: score, feedback: Option.none() }))
      }

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-early-stop",
          module: inner,
          N: Module.RolloutCount.make(5),
          reward,
          threshold: 0.9
        })
      )

      const result = yield* refined.forward({
        question: "Early stop test"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
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
      > = () => Effect.succeed(new Score({ value: 0.3, feedback: Option.none() }))

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-traced-refine",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward,
          threshold: 0.9
        })
      )

      const traced = yield* Trace.withTracing(
        refined.forward({ question: "Trace test" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      )

      const entries = Option.getOrThrow(Arr.get(traced, 1))
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
      > = () => Effect.succeed(new Score({ value: 0.3, feedback: Option.none() }))

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-drift-test",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward,
          threshold: 0.9
        })
      )

      yield* refined.forward({ question: "First call" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      const paramsAfterFirst = yield* Ref.get(inner.params)
      expect(paramsAfterFirst.instructions).toBe(baseParams.instructions)

      yield* refined.forward({ question: "Second call" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
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
              Match.when(0, () => Effect.succeed(new Score({ value: 0.2, feedback: Option.some("Try again") }))),
              Match.orElse(() =>
                Deferred.succeed(secondRewardStarted, undefined).pipe(
                  Effect.andThen(Effect.never)
                )
              )
            )
          )
        )

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-interrupted-refine",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward,
          threshold: 0.9
        })
      )

      const fiber = yield* refined.forward({ question: "Interrupt test" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.forkChild
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
            Effect.yieldNow.pipe(
              Effect.as(new Score({ value: 1, feedback: Option.none() }))
            ),
          () => Ref.update(activeRewards, Num.decrement)
        )

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-serialized-refine",
          module: inner,
          N: Module.RolloutCount.make(1),
          reward,
          threshold: 0.9
        })
      )
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
        return Effect.succeed(new Score({ value: score, feedback: Option.none() }))
      }

      const refined = yield* Module.refine(
        new Module.RefineOptions({
          name: "qa-best-overall",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward,
          threshold: 0.95
        })
      )

      const result = yield* refined.forward({
        question: "Best overall test"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(result).toEqual({ answer: "Best so far" })
    }))

  it.effect("rejects a non-positive attempt count at the RolloutCount boundary", () =>
    Effect.gen(function*() {
      const zero = yield* Schema.decodeEffect(Module.RolloutCount)(0).pipe(Effect.flip)
      const fractional = yield* Schema.decodeEffect(Module.RolloutCount)(1.5).pipe(Effect.flip)

      expect(zero._tag).toBe("SchemaError")
      expect(fractional._tag).toBe("SchemaError")
    }))
})
