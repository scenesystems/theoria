/** Public BootstrapRS transactional parameter restoration. */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { AllTrialsFailed } from "@scenesystems/effect-dsp/Errors"
import { Demo, Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { ArtifactStorageError } from "@scenesystems/effect-search/Errors"
import * as Study from "@scenesystems/effect-search/Study"
import { Array as Arr, Context, Deferred, Effect, Equal, Exit, Fiber, Number, Ref, Schema } from "effect"

const Output = Schema.Struct({ answer: Schema.String })
const Scores = Schema.Struct({ value: Schema.Number })
class Scoring extends Context.Tag("BootstrapRSRestorationScoring")<Scoring, typeof Scores.Type>() {}
const trainset = Arr.make(new Example({ input: { question: "new" }, output: { answer: "answer" } }))
const makeTree = Effect.gen(function*() {
  const signature = yield* Signature.make("Answer", { question: Schema.String }, Output.fields)
  const child = yield* Module.predict("child", signature)
  yield* Ref.set(
    child.params,
    new ModuleParams({
      instructions: "Child original",
      demos: Arr.make(new Demo({ input: { question: "old child" }, output: { answer: "child answer" } })),
      outputStrategy: "text",
      temperature: 0.3,
      maxTokens: 11
    })
  )
  const module = yield* Module.compose({
    name: "root",
    signature,
    subModules: { child },
    forward: () => Effect.succeed({ answer: "answer" })
  })
  yield* Ref.set(
    module.params,
    new ModuleParams({
      instructions: "Root original",
      demos: Arr.empty(),
      outputStrategy: "structured",
      temperature: 0.7,
      maxTokens: 23
    })
  )
  return { module, child }
})

describe("Optimizer.bootstrapRS transactional restoration", () => {
  it.effect("restores root and child refs when every candidate evaluation fails", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const originalRoot = yield* Ref.get(module.params)
      const originalChild = yield* Ref.get(child.params)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "answer" }))
      const failure = yield* Optimizer.bootstrapRS({
        module,
        trainset,
        valset: Arr.make(new Example({ input: { question: "unlabeled" } })),
        metric: Metric.exactMatch("answer"),
        numCandidates: 0
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)

      expect(failure).toBeInstanceOf(AllTrialsFailed)
      expect(yield* Ref.get(module.params)).toBe(originalRoot)
      expect(yield* Ref.get(child.params)).toBe(originalChild)
    }))

  it.effect("preserves a checked storage failure and scorer requirements after candidate mutation", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const original = yield* Module.save(module)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "answer" }))
      const storageFailure = new ArtifactStorageError({ operation: "write", path: "candidate", detail: "unavailable" })
      const storage = Study.StudyStorage.of({
        appendTrial: () => Effect.fail(storageFailure),
        writeSnapshot: () => Effect.void,
        loadSnapshot: () => Effect.succeedNone,
        loadTrialLog: () => Effect.succeed(Arr.empty()),
        replayTrialLog: () => Effect.succeed(Arr.empty())
      })
      const metric = Metric.fromEffect("service-score", (_prediction: typeof Output.Type) =>
        Effect.gen(function*() {
          const score = yield* Scoring
          return new Metric.Result({ score: score.value })
        }))
      const program = Optimizer.bootstrapRS({ module, trainset, metric, numCandidates: 0 })
      expectTypeOf<Effect.Effect.Context<typeof program>>().toEqualTypeOf<LanguageModel.LanguageModel | Scoring>()
      const failure = yield* program.pipe(
        Effect.provideService(Scoring, { value: Number.negate(2) }),
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.provideService(Study.StudyStorage, storage),
        Effect.flip
      )

      expect(Equal.equals(failure, storageFailure)).toBe(true)
      expect(yield* Module.save(module)).toEqual(original)
      expect((yield* Ref.get(child.params)).demos).toEqual((yield* Arr.last(original.modules)).params.demos)
    }))

  it.effect("restores the entire tree after interruption at a mutated-candidate scoring barrier", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const originalRoot = yield* Ref.get(module.params)
      const originalChild = yield* Ref.get(child.params)
      const entered = yield* Deferred.make<boolean>()
      const resume = yield* Deferred.make<boolean>()
      const calls = yield* Ref.make(0)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "answer" }))
      const metric = Metric.fromEffect("barrier", (_prediction: typeof Output.Type) =>
        Effect.gen(function*() {
          const call = yield* Ref.updateAndGet(calls, Number.increment)
          yield* Effect.when(
            Deferred.succeed(entered, true).pipe(Effect.zipRight(Deferred.await(resume))),
            () => Number.Equivalence(call, 2)
          )
          return new Metric.Result({ score: call })
        }))
      const fiber = yield* Optimizer.bootstrapRS({ module, trainset, metric, numCandidates: 0 }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.fork
      )
      yield* Deferred.await(entered)
      expect((yield* Ref.get(module.params)).demos).toHaveLength(1)
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.make(
        new Demo({
          input: { question: "new" },
          output: { answer: "answer" }
        })
      ))
      const exit = yield* Fiber.interrupt(fiber)

      expect(Exit.isInterrupted(exit)).toBe(true)
      expect(yield* Ref.get(module.params)).toBe(originalRoot)
      expect(yield* Ref.get(child.params)).toBe(originalChild)
    }))

  it.effect("retains the winning tree on successful optimization", () =>
    Effect.gen(function*() {
      const { module, child } = yield* makeTree
      const original = yield* Module.save(module)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "answer" }))
      const metric = Metric.fromEffect("demo-count", (_prediction: typeof Output.Type) =>
        Ref.get(module.params).pipe(Effect.map((params) =>
          new Metric.Result({ score: Arr.length(params.demos) })
        )))
      const optimized = yield* Optimizer.bootstrapRS({ module, trainset, metric, numCandidates: 0 }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      const selected = yield* Ref.get(optimized.params)

      expect(optimized).toBe(module)
      expect(selected.demos).toEqual(Arr.make(new Demo({ input: { question: "new" }, output: { answer: "answer" } })))
      expect((yield* Ref.get(child.params)).demos).toEqual(selected.demos)
      expect(yield* Module.save(module)).not.toEqual(original)
      expect(selected.temperature).toBe(0.7)
      expect((yield* Ref.get(child.params)).maxTokens).toBe(11)
    }))
})
