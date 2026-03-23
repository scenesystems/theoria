/**
 * MIPROv2 streaming contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, Fiber, Layer, Ref, Schema, Stream } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"

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

const trainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const makeOptimizerOptions = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module.Module<I, O>
) => ({
  module,
  trainset,
  valset: trainset,
  metric: Metric.exactMatch("answer"),
  numCandidates: 4,
  numInstructions: 4,
  trialBudget: 6,
  seed: 37
})

const forceStructuredOutputStrategy = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  module: Module.Module<I, O>
) =>
  Effect.gen(function*() {
    const params = yield* Ref.get(module.params)

    yield* Ref.set(
      module.params,
      new ModuleParams({
        instructions: params.instructions,
        demos: params.demos,
        outputStrategy: "structured"
      })
    )
  })

describe("Optimizer.miprov2Stream", () => {
  it.effect("emits MIPROv2 events in canonical phase order", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* forceStructuredOutputStrategy(module)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("[miprov2-proposal:")
            ? "Use concise factual answers"
            : { answer: "Paris" }
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        Optimizer.miprov2Stream(makeOptimizerOptions(module))
      ).pipe(Effect.provide(layer))

      const tags = Arr.map(Arr.fromIterable(events), (event) => event._tag)

      expect(tags).toContain("Phase1Started")
      expect(tags).toContain("Phase2Started")
      expect(tags).toContain("Phase3Started")
      expect(tags).toContain("Phase3Completed")
      expect(tags.indexOf("Phase1Started")).toBeLessThan(tags.indexOf("Phase2Started"))
      expect(tags.indexOf("Phase2Started")).toBeLessThan(tags.indexOf("Phase3Started"))
    }))

  it.live("supports interruption of the stream runtime", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* forceStructuredOutputStrategy(module)

      const slowMock = yield* MockLanguageModel.make(
        MockLanguageModel.fromFunction((prompt) =>
          Effect.sleep("50 millis").pipe(
            Effect.as(
              prompt.includes("[miprov2-proposal:")
                ? "Use concise factual answers"
                : { answer: "Paris" }
            )
          )
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, slowMock.service)
      const fiber = yield* Stream.runDrain(
        Optimizer.miprov2Stream(makeOptimizerOptions(module))
      ).pipe(
        Effect.provide(layer),
        Effect.fork
      )

      yield* Effect.sleep("10 millis")
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)

      expect(Exit.isInterrupted(exit)).toBe(true)
    }))

  it.effect("keeps stream and non-stream optimization states in parity", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const moduleA = yield* Module.predict("qa-a", signature)
      const moduleB = yield* Module.predict("qa-b", signature)

      yield* forceStructuredOutputStrategy(moduleA)
      yield* forceStructuredOutputStrategy(moduleB)

      const mockA = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("[miprov2-proposal:")
            ? "Use concise factual answers"
            : { answer: "Paris" }
        )
      )
      const mockB = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("[miprov2-proposal:")
            ? "Use concise factual answers"
            : { answer: "Paris" }
        )
      )
      const layerA = Layer.succeed(LanguageModel.LanguageModel, mockA.service)
      const layerB = Layer.succeed(LanguageModel.LanguageModel, mockB.service)

      yield* Optimizer.miprov2(makeOptimizerOptions(moduleA)).pipe(Effect.provide(layerA))
      yield* Stream.runDrain(
        Optimizer.miprov2Stream(makeOptimizerOptions(moduleB))
      ).pipe(Effect.provide(layerB))

      const stateA = yield* Module.save(moduleA)
      const stateB = yield* Module.save(moduleB)

      expect(Arr.map(stateA.modules, (entry) => entry.params)).toEqual(
        Arr.map(stateB.modules, (entry) => entry.params)
      )
    }))
})
