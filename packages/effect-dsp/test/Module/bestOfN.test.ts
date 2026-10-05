/**
 * Module.bestOfN contracts.
 */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as Cache from "@scenesystems/effect-dsp/Cache"
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
  Context,
  Effect,
  Equal,
  identity,
  Match,
  Option,
  Record,
  Ref,
  Schema,
  String as Str
} from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"

class RewardRejected extends Schema.TaggedError<RewardRejected>()(
  "RewardRejected",
  { message: Schema.String }
) {}

class RewardBehavior extends Context.Service<RewardBehavior, Effect.Effect<Score, RewardRejected>>()(
  "effect-dsp/test/bestOfN/RewardBehavior"
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

describe("Module.bestOfN", () => {
  it.effect("discovers the executed wrapper, inner composition, and descendant", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("best-discovery-predictor", signature)
      const inner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "best-discovery-pipeline",
          signature,
          subModules: Record.singleton("predictor", predictor),
          forward: ({ input }) => predictor.forward(input)
        })
      )
      const wrapper = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "best-discovery-wrapper",
          module: inner,
          N: Module.RolloutCount.make(1),
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

  it.effect("restores the inner predictor parameters before executing a loaded wrapper", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const predictor = yield* Module.predict("predictor", signature)
      yield* Ref.update(predictor.parameters, (parameters) => withInstructions(parameters, "Answer saved-city"))
      const inner = yield* Module.compose(
        new Module.ComposeOptions({
          name: "pipeline",
          signature,
          subModules: Record.singleton("predictor", predictor),
          forward: ({ input }) => predictor.forward(input)
        })
      )
      const wrapper = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "best-pipeline",
          module: inner,
          N: Module.RolloutCount.make(1),
          reward: () => Effect.succeed(new Score({ value: 1, feedback: Option.none() }))
        })
      )
      const saved = yield* Module.save(wrapper)
      yield* Ref.update(inner.parameters, (parameters) => withInstructions(parameters, "Changed pipeline"))
      yield* Ref.update(predictor.parameters, (parameters) => withInstructions(parameters, "Answer changed-city"))
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
      expect((yield* Ref.get(inner.parameters)).instructions).toBe("Changed pipeline")
    }))

  it.effect("rejects a wrapper identity that collides with the inner predictor", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const inner = yield* Module.predict("same-predictor", signature)
      const error = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "same-predictor",
          module: inner,
          N: Module.RolloutCount.make(1),
          reward: () => Effect.succeed(new Score({ value: 1, feedback: Option.none() }))
        })
      ).pipe(Effect.flip)
      expect(error._tag).toBe("CompositionError")
    }))

  it.effect("preserves a reward service requirement and checked failure identity", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Candidate" }))
      const inner = yield* Module.predict("qa-reward-channels", qa)
      const failure = new RewardRejected({ message: "reward unavailable" })
      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-best-of-reward-channels",
          module: inner,
          N: Module.RolloutCount.make(1),
          reward: () => Effect.flatMap(RewardBehavior, identity)
        })
      )
      const operation = bestOf.forward({ question: "Score this" })

      expectTypeOf<Effect.Error<typeof operation>>().toEqualTypeOf<
        AiError.AiError | DspError | RewardRejected
      >()
      expectTypeOf<Effect.Services<typeof operation>>().toEqualTypeOf<
        LanguageModel.LanguageModel | RewardBehavior
      >()

      const observed = yield* operation.pipe(
        Effect.provideService(RewardBehavior, Effect.fail(failure)),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(observed).toBe(failure)
    }))

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
        return Effect.succeed(new Score({ value: score, feedback: Option.none() }))
      }

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-best-of-3",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward
        })
      )

      const result = yield* bestOf.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(result).toEqual({ answer: "Great answer" })
    }))

  it.effect("each rollout receives a distinct RolloutRef value", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const rolloutValues = yield* Ref.make(Arr.empty<Option.Option<number>>())
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Cache.key(
            new Cache.KeyRequest({
              moduleFingerprint: "best-of",
              runtimeFingerprint: "mock",
              input: prompt,
              parameters: {}
            })
          ).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "BestOfNRolloutTest",
                method: "generateText",
                reason: new AiError.InvalidRequestError({ description: error.message })
              })
            ),
            Effect.tap((cacheKey) => Ref.update(rolloutValues, Arr.append(cacheKey.rolloutId))),
            Effect.as({ answer: "Some answer" })
          )
        )
      )
      const inner = yield* Module.predict("qa", qa)

      const reward: Module.RewardFn<
        typeof QaInput.fields,
        typeof QaOutput.fields
      > = () => Effect.succeed(new Score({ value: 0.5, feedback: Option.none() }))

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-rollout-test",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward
        })
      )

      yield* bestOf.forward({
        question: "Test question"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      const observed = yield* Ref.get(rolloutValues)
      const first = Option.getOrThrow(Arr.get(observed, 0))
      const second = Option.getOrThrow(Arr.get(observed, 1))
      const third = Option.getOrThrow(Arr.get(observed, 2))
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
        return Effect.succeed(new Score({ value: score, feedback: Option.none() }))
      }

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-threshold",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward,
          threshold: 0.7
        })
      )

      const result = yield* bestOf.forward({
        question: "Threshold test"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
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
        return Effect.succeed(new Score({ value: score, feedback: Option.none() }))
      }

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-fallback",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward,
          threshold: 0.9
        })
      )

      const result = yield* bestOf.forward({
        question: "Fallback test"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
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
      > = () => Effect.succeed(new Score({ value: 0.5, feedback: Option.none() }))

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-tiebreak",
          module: inner,
          N: Module.RolloutCount.make(3),
          reward
        })
      )

      const result = yield* bestOf.forward({
        question: "Tiebreak test"
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(result).toEqual({ answer: "First" })
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
      > = () => Effect.succeed(new Score({ value: 0.5, feedback: Option.none() }))

      const bestOf = yield* Module.bestOfN(
        new Module.BestOfNOptions({
          name: "qa-traced",
          module: inner,
          N: Module.RolloutCount.make(2),
          reward
        })
      )

      const traced = yield* Trace.withTracing(
        bestOf.forward({ question: "Traced test" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      )

      const entries = Option.getOrThrow(Arr.get(traced, 1))
      expect(entries).toHaveLength(2)
    }))
})
