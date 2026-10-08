/**
 * MIPROv2 streaming contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"

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
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) })
)

const makeOptimizerOptions = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module.Module<I, O>
) =>
  new MIPROv2.Options({
    module,
    trainset,
    valset: trainset,
    metric: Metric.exactMatch("answer"),
    numCandidates: 4,
    auto: Option.none(),
    minibatch: false,
    numTrials: 6,
    seed: 37
  })

const forceStructuredOutputStrategy = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  module: Module.Module<I, O>
) =>
  Effect.gen(function*() {
    const parameters = yield* Ref.get(module.parameters)

    yield* Ref.set(
      module.parameters,
      new ModuleParameters({
        instructions: parameters.instructions,
        demos: parameters.demos,
        outputStrategy: "structured"
      })
    )
  })

describe("MIPROv2.stream", () => {
  it.effect("emits MIPROv2 events in canonical phase order", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* forceStructuredOutputStrategy(module)

      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Bool.match(Str.includes("Return only ")(prompt), {
            onFalse: () => ({ answer: "Paris" }),
            onTrue: () => "Use concise factual answers"
          })
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const events = yield* Stream.runCollect(
        MIPROv2.stream(makeOptimizerOptions(module))
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
              Bool.match(Str.includes("Return only ")(prompt), {
                onFalse: () => ({ answer: "Paris" }),
                onTrue: () => "Use concise factual answers"
              })
            )
          )
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, slowMock.service)
      const fiber = yield* Stream.runDrain(
        MIPROv2.stream(makeOptimizerOptions(module))
      ).pipe(
        Effect.provide(layer),
        Effect.forkScoped
      )

      yield* Effect.sleep("10 millis")
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)

      expect(Exit.hasInterrupts(exit)).toBe(true)
    }))

  it.effect("summarizes streamed events into the run report and leaves both modules' saved state unchanged", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const moduleA = yield* Module.predict("qa-a", signature)
      const moduleB = yield* Module.predict("qa-b", signature)

      yield* forceStructuredOutputStrategy(moduleA)
      yield* forceStructuredOutputStrategy(moduleB)

      const mockA = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Bool.match(Str.includes("Return only ")(prompt), {
            onFalse: () => ({ answer: "Paris" }),
            onTrue: () => "Use concise factual answers"
          })
        )
      )
      const mockB = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Bool.match(Str.includes("Return only ")(prompt), {
            onFalse: () => ({ answer: "Paris" }),
            onTrue: () => "Use concise factual answers"
          })
        )
      )
      const layerA = Layer.succeed(LanguageModel.LanguageModel, mockA.service)
      const layerB = Layer.succeed(LanguageModel.LanguageModel, mockB.service)

      const beforeA = yield* Module.save(moduleA)
      const beforeB = yield* Module.save(moduleB)
      const compiled = yield* MIPROv2.run(makeOptimizerOptions(moduleA)).pipe(Effect.provide(layerA))
      const events = yield* Stream.runCollect(
        MIPROv2.stream(makeOptimizerOptions(moduleB))
      ).pipe(Effect.provide(layerB))

      const stateA = yield* Module.save(moduleA)
      const stateB = yield* Module.save(moduleB)

      expect(compiled.report).toEqual(MIPROv2.summarizeEvents(events))
      expect(stateA).toEqual(beforeA)
      expect(stateB).toEqual(beforeB)
    }))
})
