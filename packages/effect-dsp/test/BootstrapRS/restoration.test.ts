/** Public BootstrapRS transactional parameter restoration. */
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as Evaluate from "@scenesystems/effect-dsp/Evaluate"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Context, Deferred, Effect, Exit, Fiber, Number, Option, Record, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import type { Services as EffectServices } from "effect/Effect"

const Output = Schema.Struct({ answer: Schema.String })
const Scores = Schema.Struct({ value: Schema.Finite })
class Scoring extends Context.Service<Scoring, typeof Scores.Type>()("BootstrapRSRestorationScoring") {}
const trainset = Arr.make(new Example({ input: { question: "new" }, labels: Option.some({ answer: "answer" }) }))
const makeTree = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, Output.fields)
  const child = yield* Module.predict("child", signature)
  yield* Ref.set(
    child.parameters,
    new ModuleParameters({
      instructions: "Child original",
      demos: Arr.make(new Demonstration({ input: { question: "old child" }, output: { answer: "child answer" } })),
      outputStrategy: "text",
      temperature: 0.3,
      maxTokens: 11
    })
  )
  const module = yield* Module.compose(
    new Module.ComposeOptions({
      name: "root",
      signature,
      subModules: { child },
      forward: () => Effect.succeed({ answer: "answer" })
    })
  )
  yield* Ref.set(
    module.parameters,
    new ModuleParameters({
      instructions: "Root original",
      demos: Arr.empty(),
      outputStrategy: "structured",
      temperature: 0.7,
      maxTokens: 23
    })
  )
  return { module, child }
})

describe("BootstrapRS.run transactional restoration", () => {
  it.effect("restores root and child refs when every candidate evaluation fails", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const originalRoot = yield* Ref.get(module.parameters)
      const originalChild = yield* Ref.get(child.parameters)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const failure = yield* BootstrapRS.run(
        new BootstrapRS.Options({
          module,
          trainset,
          valset: Arr.make(new Example({ input: { question: 73 } })),
          metric: Metric.exactMatch("answer"),
          numCandidatePrograms: 0,
          maxErrors: Option.some(1)
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)

      expect(failure).toEqual(new Evaluate.TooManyErrors({ count: 1, limit: 1 }))
      expect(yield* Ref.get(module.parameters)).toBe(originalRoot)
      expect(yield* Ref.get(child.parameters)).toBe(originalChild)
    }))

  it.effect("preserves scorer requirements and caller parameters when the metric exhausts maxErrors", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const original = yield* Module.save(module)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const metric = Metric.withFeedback(() =>
        Effect.gen(function*() {
          const score = yield* Scoring
          return yield* Effect.fail(score.value)
        }), "service-score")
      const program = BootstrapRS.run(
        new BootstrapRS.Options({ module, trainset, metric, numCandidatePrograms: 0, maxErrors: Option.some(1) })
      )
      expectTypeOf<EffectServices<typeof program>>().toEqualTypeOf<LanguageModel.LanguageModel | Scoring>()
      const failure = yield* program.pipe(
        Effect.provideService(Scoring, { value: Number.multiply(2, -1) }),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure).toEqual(new Evaluate.TooManyErrors({ count: 1, limit: 1 }))
      expect(yield* Module.save(module)).toEqual(original)
      expect((yield* Ref.get(child.parameters)).demos).toEqual(
        Option.getOrThrow(Record.get(original.parameters, "root.child")).demos
      )
    }))

  it.effect("restores the entire tree after interruption at a mutated-candidate scoring barrier", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const originalRoot = yield* Ref.get(module.parameters)
      const originalChild = yield* Ref.get(child.parameters)
      const entered = yield* Deferred.make<boolean>()
      const resume = yield* Deferred.make<boolean>()
      const calls = yield* Ref.make(0)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const metric = Metric.withFeedback(() =>
        Effect.gen(function*() {
          const call = yield* Ref.updateAndGet(calls, Number.increment)
          yield* Effect.when(
            Deferred.succeed(entered, true).pipe(Effect.andThen(Deferred.await(resume))),
            Effect.succeed(Number.Equivalence(call, 2))
          )
          return new Metric.Score({ value: call, feedback: Option.none() })
        }), "barrier")
      const fiber = yield* BootstrapRS.run(
        new BootstrapRS.Options({ module, trainset, metric, numCandidatePrograms: 0 })
      )
        .pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service),
          Effect.forkScoped
        )
      yield* Deferred.await(entered)
      expect(yield* Ref.get(module.parameters)).toBe(originalRoot)
      expect(yield* Ref.get(child.parameters)).toBe(originalChild)
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)

      expect(Exit.hasInterrupts(exit)).toBe(true)
      expect(yield* Ref.get(module.parameters)).toBe(originalRoot)
      expect(yield* Ref.get(child.parameters)).toBe(originalChild)
    }))

  it.effect("retains the winning tree on successful optimization", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const original = yield* Module.save(module)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "answer" }))
      const calls = yield* Ref.make(0)
      const metric = Metric.withFeedback(() =>
        Ref.updateAndGet(calls, Number.increment).pipe(Effect.map((score) =>
          new Metric.Score({ value: score / 2, feedback: Option.none() })
        )), "candidate-score")
      const optimized = yield* BootstrapRS.run(
        new BootstrapRS.Options({ module, trainset, metric, numCandidatePrograms: 0, stopAtScore: Option.some(1) })
      )
        .pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      const selected = Option.getOrThrow(Record.get(optimized.parameters, "root.child"))

      expect(optimized.program).not.toBe(module)
      expect(Arr.map(selected.demos, (demo) => ({ input: demo.input, output: demo.output }))).toEqual(
        [{ input: { question: "new" }, output: { answer: "answer" } }]
      )
      expect(yield* Module.save(module)).toEqual(original)
      expect(selected.temperature).toBe(0.3)
      expect((yield* Ref.get(child.parameters)).maxTokens).toBe(11)
    }))
})
