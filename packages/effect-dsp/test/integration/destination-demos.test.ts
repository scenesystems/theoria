/** Destination-specific optimization must produce executable programs. */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Toolkit from "@effect/ai/Toolkit"
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as LabeledFewShot from "@scenesystems/effect-dsp/LabeledFewShot"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { withDemos } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Boolean, Deferred, Effect, Fiber, Layer, Number, Ref, Schema, String } from "effect"
import * as MIPROv2Candidates from "../../src/MIPROv2Candidates.js"

const rows = Arr.make(new Example({ input: { question: "France" }, output: { answer: "Paris" } }))

const makePipeline = Effect.gen(function*() {
  const rootSignature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const childSignature = yield* Signature.make("Analyze context", {
    question: Schema.String,
    context: Schema.String
  }, { analysis: Schema.String })
  const child = yield* Module.predict("analyzer", childSignature)
  const root = yield* Module.compose({
    name: "pipeline",
    signature: rootSignature,
    subModules: { child },
    forward: ({ input }) =>
      child.forward({ question: input.question, context: "Cities" }).pipe(
        Effect.map(({ analysis }) => ({ answer: analysis }))
      )
  })
  return { root, child }
})

describe("destination-owned demonstrations", () => {
  it.effect("rejects incompatible labeled demos before changing any predictor", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const initialRoot = yield* Ref.get(root.params)
      const initialChild = yield* Ref.get(child.params)
      const failure = yield* LabeledFewShot.run({ module: root, trainset: rows, k: 1 }).pipe(Effect.flip)
      expect(failure._tag).toBe("ParseError")
      expect(yield* Ref.get(root.params)).toBe(initialRoot)
      expect(yield* Ref.get(child.params)).toBe(initialChild)
    }))

  it.effect("builds the automatic labeled baseline independently for each destination", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "Paris" }))
      const metric = Metric.fromEffect("root-label-count", (_prediction: Signature.Output<typeof root.signature>) =>
        Ref.get(root.params).pipe(
          Effect.map((params) =>
            new Metric.Result({ score: Arr.length(params.demos) })
          )
        ))

      yield* BootstrapRS.run({
        module: root,
        trainset: rows,
        metric,
        numCandidates: 0
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect((yield* Ref.get(root.params)).demos).toEqual(Arr.make(
        new Demonstration({ input: { question: "France" }, output: { answer: "Paris" } })
      ))
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.empty())
    }))

  it.effect("bootstraps stage traces and replays the heterogeneous child with automatic text mode", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        { analysis: "Paris" },
        "[[ ## analysis ## ]]\nParis"
      )))
      yield* BootstrapFewShot.run({
        module: root,
        trainset: rows,
        metric: Metric.exactMatch("answer"),
        maxRounds: 1,
        maxBootstrappedDemos: 1,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(root.params)).demos).toEqual(Arr.make(
        new Demonstration({ input: { question: "France" }, output: { answer: "Paris" } })
      ))
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.make(
        new Demonstration({ input: { question: "France", context: "Cities" }, output: { analysis: "Paris" } })
      ))
      expect(
        yield* root.forward({ question: "France" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ answer: "Paris" })
      expect(Arr.map(yield* Ref.get(mock.calls), (call) => call.method)).toEqual(
        Arr.make("generateObject", "generateText")
      )
    }))

  it.effect("uses only destination-valid labels and stage demos in MIPRO phase one", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const stage = new Demonstration({
        input: { question: "France", context: "Cities" },
        output: { analysis: "Paris" }
      })
      yield* Ref.update(child.params, (params) => withDemos(params, Arr.make(stage)))
      const sets = yield* MIPROv2Candidates.generateDemoCandidates({ module: root, trainset: rows, numCandidates: 4 })
      const childSet = yield* Arr.findFirst(sets, (set) => Schema.is(Schema.Literal("analyzer"))(set.predictorName))
      const labeled = yield* Arr.get(childSet.candidates, 1)
      const bootstrapped = yield* Arr.get(childSet.candidates, 2)
      expect(labeled.params.demos).toEqual(Arr.empty())
      expect(bootstrapped.params.demos).toEqual(Arr.make(stage))
      yield* Effect.forEach(
        childSet.candidates,
        (candidate) => Effect.forEach(candidate.params.demos, child.signature.demonstrationCodec.decode)
      )
    }))

  it.effect("returns an executable heterogeneous program from public MIPRO optimization", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "Paris" }))
      yield* MIPROv2.run({
        module: root,
        trainset: rows,
        metric: Metric.exactMatch("answer"),
        numCandidates: 3,
        numInstructions: 1,
        trialBudget: 2
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.empty())
      expect(
        yield* root.forward({ question: "France" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ answer: "Paris" })
    }))

  it.effect("runs default BootstrapRS with a destination-aware baseline and replays its stage demos", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Boolean.match(String.includes("training-stage-marker")(prompt), {
            onTrue: () => "[[ ## analysis ## ]]\nParis",
            onFalse: () => ({ analysis: "Paris" })
          })
        )
      )
      // A compatible stage demonstration makes the bootstrap candidate observably
      // better than either baseline, and teaches the mock's automatic text replay.
      const teacher = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "training-stage-marker" }))
      const metric = Metric.fromEffect(
        "stage-evidence",
        (_prediction: Signature.Output<typeof root.signature>) =>
          Ref.get(child.params).pipe(
            Effect.map((params) => new Metric.Result({ score: Number.increment(Arr.length(params.demos)) }))
          )
      )
      yield* BootstrapRS.run({
        module: root,
        trainset: rows,
        metric,
        numCandidates: 1,
        teacher: Layer.succeed(LanguageModel.LanguageModel, teacher.service)
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(root.params)).demos).toHaveLength(1)
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.make(
        new Demonstration({
          input: { question: "France", context: "Cities" },
          output: { analysis: "training-stage-marker" }
        })
      ))
      expect(
        yield* root.forward({ question: "France" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ answer: "Paris" })
    }))

  it.effect("excludes intermediate ReAct child turns from accepted demonstrations", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const toolkit = yield* Toolkit.empty.pipe(Effect.provide(Toolkit.empty.toLayer({})))
      const child = yield* Module.react({ name: "reasoner", signature, toolkit, maxIterations: 2 })
      const root = yield* Module.compose({
        name: "reasoning-pipeline",
        signature,
        subModules: { child },
        forward: ({ input }) => child.forward(input)
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        "not an answer",
        "[[ ## answer ## ]]\nParis"
      )))
      yield* BootstrapFewShot.run({
        module: root,
        trainset: rows,
        metric: Metric.exactMatch("answer"),
        maxRounds: 1,
        maxBootstrappedDemos: 3,
        fallbackToLabeledFewShot: false
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(child.params)).demos).toEqual(Arr.make(
        new Demonstration({ input: { question: "France" }, output: { answer: "Paris" } })
      ))
    }))

  it.effect("restores every predictor after interrupting a teacher run", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const rootBefore = yield* Ref.get(root.params)
      const childBefore = yield* Ref.get(child.params)
      const entered = yield* Deferred.make<void>()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction(() =>
          Deferred.complete(entered, Effect.void).pipe(Effect.zipRight(Effect.never))
        )
      )
      const fiber = yield* BootstrapFewShot.run({
        module: root,
        trainset: rows,
        metric: Metric.exactMatch("answer"),
        maxRounds: 1,
        maxBootstrappedDemos: 1
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.fork)
      yield* Deferred.await(entered)
      expect((yield* Ref.get(child.params)).instructions).toContain("bootstrap-round")
      yield* Fiber.interrupt(fiber)
      expect(yield* Ref.get(root.params)).toEqual(rootBefore)
      expect(yield* Ref.get(child.params)).toEqual(childBefore)
    }))
})
