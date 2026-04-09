/**
 * GEPA streaming contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Schema, Stream } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import { MockLanguageModel } from "effect-dsp/test"
import {
  GepaOrchestrationEventOrderFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

const runSeededStream = (moduleName: string, seed: number) =>
  Effect.gen(function*() {
    const signature = yield* conciseFactsQaSignature
    const module = yield* Module.predict(moduleName, signature)
    const mock = yield* MockLanguageModel.make(
      MockLanguageModel.map((prompt) =>
        prompt.includes("France")
          ? { answer: "Paris" }
          : { answer: "Tokyo" }
      )
    )
    const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

    return yield* Stream.runCollect(
      Optimizer.gepaStream({
        module,
        trainset: Arr.make(
          new Example({
            input: { question: "What is the capital of France?" },
            output: { answer: "Paris" }
          }),
          new Example({
            input: { question: "What is the capital of Japan?" },
            output: { answer: "Tokyo" }
          }),
          new Example({
            input: { question: "What is the capital of Germany?" },
            output: { answer: "Berlin" }
          })
        ),
        metric: Metric.exactMatch("answer"),
        maxIterations: 3,
        seed
      })
    ).pipe(Effect.provide(layer))
  })

describe("Optimizer.gepaStream", () => {
  it.effect(
    "emits deterministic event order under fixed seed and fixtures",
    () =>
      Effect.gen(function*() {
        const rawSelectionFixture = yield* loadFixture("dspy.gepa.selection.weights.seed-42")
        const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
        const selectionFixture = yield* Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema)(rawSelectionFixture)
        const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
          rawEventOrderFixture
        )
        const firstRun = yield* runSeededStream("qa-seeded", selectionFixture.payload.seed)
        const secondRun = yield* runSeededStream("qa-seeded", selectionFixture.payload.seed)
        const firstEvents = Arr.fromIterable(firstRun)
        const secondEvents = Arr.fromIterable(secondRun)

        expect(secondEvents).toEqual(firstEvents)
        expect(Arr.map(firstEvents, (event) => event._tag)).toContain("OptimizationCompleted")
        expect(Arr.map(firstEvents, (event) => event._tag)).toContain("ParetoUpdated")
        expect(eventOrderFixture.payload.expectedTerminalTag).toBe("OptimizationCompleted")
        expect(eventOrderFixture.payload.expectedWithinIterationOrder.length).toBeGreaterThan(0)
      })
  )
})
