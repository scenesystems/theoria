/** Destination-specific optimization must produce executable programs. */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import * as BootstrapRS from "@scenesystems/effect-dsp/BootstrapRS"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { Example, Id } from "@scenesystems/effect-dsp/Example"
import * as LabeledFewShot from "@scenesystems/effect-dsp/LabeledFewShot"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import { Array as Arr, Boolean, Deferred, Effect, Fiber, Option, Record, Ref, Schema, String } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Toolkit from "effect/ai/Toolkit"
import * as MIPROv2Candidates from "../../src/MIPROv2Candidates.js"

const rows = Arr.make(
  new Example({
    id: Option.some(Id.make("france")),
    input: { question: "France" },
    labels: Option.some({ answer: "Paris" })
  })
)

const makePipeline = Effect.gen(function*() {
  const rootSignature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
  const childSignature = yield* Signature.make("Analyze context", {
    question: Schema.String,
    context: Schema.String
  }, { analysis: Schema.String })
  const child = yield* Module.predict("analyzer", childSignature)
  const root = yield* Module.compose(
    new Module.ComposeOptions({
      name: "pipeline",
      signature: rootSignature,
      subModules: { child },
      forward: ({ input }) =>
        child.forward({ question: input.question, context: "Cities" }).pipe(
          Effect.map(({ analysis }) => ({ answer: analysis }))
        )
    })
  )
  return { root, child }
})

describe("destination-owned demonstrations", () => {
  it.effect("rejects incompatible labeled demos before changing any predictor", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const initialRoot = yield* Ref.get(root.parameters)
      const initialChild = yield* Ref.get(child.parameters)
      const failure = yield* LabeledFewShot.run(new LabeledFewShot.Options({ module: root, trainset: rows, k: 1 }))
        .pipe(Effect.flip)
      expect(failure._tag).toBe("SchemaError")
      expect(yield* Ref.get(root.parameters)).toBe(initialRoot)
      expect(yield* Ref.get(child.parameters)).toBe(initialChild)
    }))

  it.effect("rejects an incompatible labeled baseline without changing the destination", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "Paris" }))
      const metric = Metric.exactMatch("answer")

      const failure = yield* BootstrapRS.run(
        new BootstrapRS.Options({
          module: root,
          trainset: rows,
          metric,
          numCandidatePrograms: 0
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.flip)

      expect(failure._tag).toBe("SchemaError")
      expect((yield* Ref.get(child.parameters)).demos).toEqual(Arr.empty())
    }))

  it.effect("bootstraps stage traces and replays the heterogeneous child with automatic text mode", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        { analysis: "Paris" },
        "[[ ## analysis ## ]]\nParis"
      )))
      const compiled = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module: root,
          trainset: rows,
          metric: Metric.exactMatch("answer"),
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 0
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(child.parameters)).demos).toEqual(Arr.empty())
      expect(Option.getOrThrow(Record.get(compiled.parameters, "pipeline.child")).demos).toEqual(Arr.make(
        new Demonstration({
          input: { question: "France", context: "Cities" },
          output: { analysis: "Paris" },
          augmented: true,
          exampleId: Option.some(Id.make("france"))
        })
      ))
      expect(
        yield* compiled.program.forward({ question: "France" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ answer: "Paris" })
      expect(Arr.map(yield* Ref.get(mock.calls), (call) => call.method)).toEqual(
        Arr.make("generateObject", "generateText")
      )
    }))

  it.effect("derives destination-specific MIPRO demos from teacher calls rather than root labels", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const stage = new Demonstration({
        input: { question: "France", context: "Cities" },
        output: { analysis: "Paris" },
        augmented: true,
        exampleId: Option.some(Id.make("france"))
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "Paris" }))
      const sets = yield* MIPROv2Candidates.generateDemoCandidates(
        new MIPROv2Candidates.GenerateDemoCandidatesOptions({
          module: root,
          trainset: rows,
          numCandidates: 4,
          maxLabeledDemos: 0,
          maxBootstrappedDemos: 1
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const childSet = Option.getOrThrow(
        Arr.findFirst(sets, (set) => Schema.is(Schema.Literal("analyzer"))(set.predictorName))
      )
      const shuffled = Option.getOrThrow(Arr.get(childSet.candidates, 1))
      const bootstrapped = Option.getOrThrow(Arr.get(childSet.candidates, 2))
      expect(shuffled.kind).toBe("bootstrap-shuffled")
      expect(shuffled.parameters.demos).toEqual(Arr.make(stage))
      expect(bootstrapped.parameters.demos).toEqual(Arr.make(stage))
      expect((yield* Ref.get(child.parameters)).demos).toEqual([])
      yield* Effect.forEach(
        childSet.candidates,
        (candidate) => Effect.forEach(candidate.parameters.demos, child.signature.demonstrationCodec.decode)
      )
    }))

  it.effect("returns an executable heterogeneous program from public MIPRO optimization", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      yield* Module.install(root, {
        "pipeline.child": new ModuleParameters({
          instructions: (yield* Ref.get(child.parameters)).instructions,
          demos: [],
          outputStrategy: "text"
        })
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed("[[ ## analysis ## ]]\nParis\n[[ ## completed ## ]]")
      )
      const compiled = yield* MIPROv2.run(
        new MIPROv2.Options({
          module: root,
          trainset: rows,
          metric: Metric.exactMatch("answer"),
          numCandidates: 3,
          numInstructions: 1,
          maxLabeledDemos: 0,
          maxBootstrappedDemos: 1,
          trialBudget: 2
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect((yield* Ref.get(child.parameters)).demos).toEqual(Arr.empty())
      expect(
        yield* compiled.program.forward({ question: "France" }).pipe(
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
            onFalse: () => ({ analysis: "incorrect" })
          })
        )
      )
      // A compatible stage demonstration makes the bootstrap candidate observably
      // better than either baseline, and teaches the mock's automatic text replay.
      const teacher = yield* MockLanguageModel.make(MockLanguageModel.succeed({ analysis: "training-stage-marker" }))
      const metric = Metric.fromSync((_labels, prediction) =>
        Boolean.match(prediction.answer === "Paris", {
          onTrue: () => 2,
          onFalse: () =>
            Boolean.match(prediction.answer === "training-stage-marker", {
              onTrue: () => 1,
              onFalse: () => 0
            })
        }), "stage-evidence")
      const compiled = yield* BootstrapRS.run(
        new BootstrapRS.Options({
          module: root,
          trainset: rows,
          metric,
          numCandidatePrograms: 1,
          maxLabeledDemos: 0
        })
      ).pipe(
        ModelBinder.withBinder(
          new ModelBinder.Binder({
            bind: (request) => (effect) =>
              effect.pipe(
                Effect.provideService(
                  LanguageModel.LanguageModel,
                  request.role === "teacher" ? teacher.service : mock.service
                )
              )
          })
        ),
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )
      expect((yield* Ref.get(child.parameters)).demos).toEqual(Arr.empty())
      expect(Option.getOrThrow(Record.get(compiled.parameters, "pipeline.child")).demos).toEqual(Arr.make(
        new Demonstration({
          input: { question: "France", context: "Cities" },
          output: { analysis: "training-stage-marker" },
          augmented: true,
          exampleId: Option.some(Id.make("france"))
        })
      ))
      expect(
        yield* compiled.program.forward({ question: "France" }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, mock.service)
        )
      ).toEqual({ answer: "Paris" })
    }))

  it.effect("excludes intermediate ReAct child turns from accepted demonstrations", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const toolkit = yield* Toolkit.empty.pipe(Effect.provide(Toolkit.empty.toLayer({})))
      const child = yield* Module.react(
        new Module.ReactOptions({ name: "reasoner", signature, toolkit, maxIterations: 2 })
      )
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "reasoning-pipeline",
          signature,
          subModules: { child },
          forward: ({ input }) => child.forward(input)
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.make(
        "not an answer",
        "[[ ## answer ## ]]\nParis"
      )))
      const compiled = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module: root,
          trainset: rows,
          metric: Metric.exactMatch("answer"),
          maxRounds: 1,
          maxBootstrappedDemos: 3,
          maxLabeledDemos: 0
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      expect(Option.getOrThrow(Record.get(compiled.parameters, "reasoning-pipeline.child")).demos).toEqual(Arr.make(
        new Demonstration({
          input: { question: "France" },
          output: { answer: "Paris" },
          augmented: true,
          exampleId: Option.some(Id.make("france"))
        })
      ))
    }))

  it.effect("restores every predictor after interrupting a teacher run", () =>
    Effect.gen(function*() {
      const { root, child } = yield* makePipeline
      const rootBefore = yield* Ref.get(root.parameters)
      const childBefore = yield* Ref.get(child.parameters)
      const entered = yield* Deferred.make<void>()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction(() => Deferred.complete(entered, Effect.void).pipe(Effect.andThen(Effect.never)))
      )
      const fiber = yield* BootstrapFewShot.run(
        new BootstrapFewShot.Options({
          module: root,
          trainset: rows,
          metric: Metric.exactMatch("answer"),
          maxRounds: 1,
          maxBootstrappedDemos: 1,
          maxLabeledDemos: 0
        })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service), Effect.forkScoped)
      yield* Deferred.await(entered)
      expect(yield* Ref.get(child.parameters)).toBe(childBefore)
      yield* Fiber.interrupt(fiber)
      expect(yield* Ref.get(root.parameters)).toEqual(rootBefore)
      expect(yield* Ref.get(child.parameters)).toEqual(childBefore)
    }))
})
