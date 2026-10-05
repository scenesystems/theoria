/** Public MIPROv2 failure-aware candidate selection. */
import { describe, expect, it } from "@effect/vitest"
import { AllTrialsFailed } from "@scenesystems/effect-dsp/DspError"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean, Effect, Fiber, Number, Option, Record, Ref, Schema, String } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as TestClock from "effect/testing/TestClock"

const Output = Schema.Struct({ answer: Schema.String })
class ScorerFailed extends Schema.TaggedError<ScorerFailed>()("ScorerFailed", {}) {}
const trainset = Arr.make(new Example({ input: { question: "question" }, output: { answer: "answer" } }))
const invalid = new Example({ input: { question: "invalid label" }, output: { answer: 42 } })
const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make("Baseline instruction", { question: Schema.String }, Output.fields)
  const module = yield* Module.predict("qa", signature)
  yield* Ref.set(
    module.params,
    new ModuleParameters({
      instructions: "Baseline instruction",
      demos: Arr.empty(),
      outputStrategy: "structured"
    })
  )
  return module
})

describe("MIPROv2.run failure-aware scores", () => {
  it.effect("fails through the checked channel when every scorer invocation fails", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const calls = yield* Ref.make(0)
      const metric = Metric.fromEffect("failed", (_prediction: typeof Output.Type) =>
        Ref.update(calls, Number.increment).pipe(Effect.andThen(Effect.fail(new ScorerFailed()))))
      const failure = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          metric,
          numCandidates: 1,
          numInstructions: 1,
          trialBudget: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)

      expect(failure).toBeInstanceOf(AllTrialsFailed)
      expect(yield* Ref.get(calls)).toBe(1)
    }))

  it.effect("rejects entirely malformed validation labels instead of projecting a zero score", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const failure = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: Arr.make(invalid),
          metric: Metric.exactMatch("answer"),
          numCandidates: 1,
          numInstructions: 1,
          trialBudget: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)

      expect(failure).toBeInstanceOf(AllTrialsFailed)
      const report = yield* Schema.decodeUnknownEffect(AllTrialsFailed)(failure)
      expect(report.trialCount).toBe(1)
      expect(yield* Ref.get(mock.calls)).toHaveLength(0)
    }))

  it.effect("does not rank a failed candidate above valid negative scores", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const rejected = yield* Ref.make(0)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) =>
        Boolean.match(String.includes("[miprov2-proposal:")(prompt), {
          onTrue: () => "Unscorable instruction",
          onFalse: () => ({
            answer: Boolean.match(String.includes("Unscorable instruction")(prompt), {
              onTrue: () => "failed",
              onFalse: () => "valid"
            })
          })
        })
      ))
      const metric = Metric.fromEffect("negative", (prediction: typeof Output.Type) =>
        Boolean.match(String.Equivalence(prediction.answer, "failed"), {
          onTrue: () =>
            Ref.update(rejected, Number.increment).pipe(Effect.andThen(Effect.fail(new ScorerFailed()))),
          onFalse: () =>
            Effect.succeed(new Metric.Result({ score: Number.multiply(7, -1) }))
        }))
      const fiber = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          metric,
          numCandidates: 1,
          numInstructions: 2,
          trialBudget: 12,
          fullEvalEvery: 2,
          seed: 13
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkScoped)
      yield* TestClock.adjust("1 minute")
      const optimized = yield* Fiber.join(fiber)

      expect(yield* Ref.get(rejected)).toBeGreaterThan(0)
      expect(Option.getOrThrow(Record.get(optimized.parameters, "qa")).instructions).toBe("Baseline instruction")
    }))

  it.effect("retains genuine partial-failure reports and the successful baseline when all minibatches fail", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const fiber = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: Arr.prepend(trainset, invalid),
          metric: Metric.make(
            "negative",
            (_prediction: typeof Output.Type) => new Metric.Result({ score: Number.multiply(3, -1) })
          ),
          numCandidates: 1,
          numInstructions: 1,
          trialBudget: 3,
          minibatchSize: 1,
          fullEvalEvery: 1
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkScoped)
      yield* TestClock.adjust("1 minute")
      const optimized = yield* Fiber.join(fiber)

      expect(optimized.program).not.toBe(module)
      expect(Option.getOrThrow(Record.get(optimized.parameters, "qa")).instructions).toBe("Baseline instruction")
      // Label preflight excludes the invalid row before execution; only the valid baseline row runs.
      expect(yield* Ref.get(mock.calls)).toHaveLength(1)
    }))
})
