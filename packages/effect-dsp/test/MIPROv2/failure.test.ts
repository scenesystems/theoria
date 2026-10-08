/** Public MIPROv2 failure-aware candidate selection. */
import { describe, expect, it } from "@effect/vitest"
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
const trainset = Arr.make(new Example({ input: { question: "question" }, labels: Option.some({ answer: "answer" }) }))
const invalid = new Example({ input: { question: 42 }, labels: Option.some({ answer: "answer" }) })
const makeMock = () =>
  MockLanguageModel.make(
    MockLanguageModel.map((prompt) =>
      Boolean.match(String.includes("Return only ")(prompt), {
        onFalse: () => ({ answer: "answer" }),
        onTrue: () => "instruction"
      })
    )
  )
const makeModule = Effect.gen(function*() {
  const signature = yield* Signature.make("Baseline instruction", { question: Schema.String }, Output.fields)
  const module = yield* Module.predict("qa", signature)
  yield* Ref.set(
    module.parameters,
    new ModuleParameters({
      instructions: "Baseline instruction",
      demos: Arr.empty(),
      outputStrategy: "structured"
    })
  )
  return module
})

describe("MIPROv2.run failure-aware scores", () => {
  it.effect("records zero for evaluations where every scorer invocation fails", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* makeMock()
      const calls = yield* Ref.make(0)
      const metric = Metric.withFeedback(
        () => Ref.update(calls, Number.increment).pipe(Effect.andThen(Effect.fail(new ScorerFailed()))),
        "failed"
      )
      const optimized = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: trainset,
          metric,
          numCandidates: 1,
          auto: Option.none(),
          minibatch: false,
          numTrials: 2,
          maxErrors: Option.some(1)
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(optimized.report.phase3BestScore).toBe(0)
      expect(Arr.map(optimized.report.trials, (trial) => trial.score)).toEqual([0, 0, 0])
      expect(yield* Ref.get(calls)).toBe(3)
    }))

  it.effect("records zero for entirely malformed validation inputs without invoking the task model", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* makeMock()
      const optimized = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: Arr.make(invalid),
          metric: Metric.exactMatch("answer"),
          numCandidates: 1,
          auto: Option.none(),
          minibatch: false,
          numTrials: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(Arr.map(optimized.report.trials, (trial) => trial.score)).toEqual([0, 0, 0])
      expect(Arr.filter(yield* Ref.get(mock.calls), (call) => String.Equivalence(call.method, "generateObject")))
        .toHaveLength(0)
    }))

  it.effect("upstream zero failure scores can beat valid negative scores", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const rejected = yield* Ref.make(0)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) =>
        Boolean.match(String.includes("Return only ")(prompt), {
          onTrue: () => "Unscorable instruction",
          onFalse: () => ({
            answer: Boolean.match(String.includes("Unscorable instruction")(prompt), {
              onTrue: () => "failed",
              onFalse: () => "valid"
            })
          })
        })
      ))
      const metric = Metric.withFeedback((_example, result) =>
        Effect.gen(function*() {
          const prediction = yield* Schema.decodeUnknownEffect(Output)(result.output)
          return yield* Boolean.match(String.Equivalence(prediction.answer, "failed"), {
            onTrue: () =>
              Ref.update(rejected, Number.increment).pipe(Effect.andThen(Effect.fail(new ScorerFailed()))),
            onFalse: () => Effect.succeed(new Metric.Score({ value: Number.multiply(7, -1), feedback: Option.none() }))
          })
        }), "negative")
      const fiber = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: trainset,
          metric,
          numCandidates: 2,
          auto: Option.none(),
          minibatch: false,
          numTrials: 12,
          seed: 13
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkScoped)
      yield* TestClock.adjust("1 minute")
      const optimized = yield* Fiber.join(fiber)

      expect(yield* Ref.get(rejected)).toBeGreaterThan(0)
      expect(Option.getOrThrow(Record.get(optimized.parameters, "qa")).instructions).toBe("Unscorable instruction")
      expect(optimized.report.phase3BestScore).toBe(0)
    }))

  it.effect("keeps failures in the full-validation denominator and retains the baseline on ties", () =>
    Effect.gen(function*() {
      const module = yield* makeModule
      const mock = yield* makeMock()
      const fiber = yield* MIPROv2.run(
        new MIPROv2.Options({
          module,
          trainset,
          valset: Arr.prepend(trainset, invalid),
          metric: Metric.fromSync(() => Number.multiply(3, -1), "negative"),
          numCandidates: 1,
          auto: Option.none(),
          minibatch: false,
          numTrials: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkScoped)
      yield* TestClock.adjust("1 minute")
      const optimized = yield* Fiber.join(fiber)

      expect(optimized.program).not.toBe(module)
      expect(Option.getOrThrow(Record.get(optimized.parameters, "qa")).instructions).toBe("Baseline instruction")
      expect(Arr.map(optimized.report.trials, (trial) => trial.score)).toEqual([-1.5, -1.5, -1.5])
      // Invalid rows never reach the model, but stay in every evaluation's denominator.
      expect(Arr.filter(yield* Ref.get(mock.calls), (call) => String.Equivalence(call.method, "generateObject")))
        .toHaveLength(3)
    }))
})
