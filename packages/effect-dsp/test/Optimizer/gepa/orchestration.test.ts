/**
 * GEPA orchestration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Schema, Stream } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import * as Signature from "effect-dsp/Signature"
import { MockLanguageModel } from "effect-dsp/test"
import {
  GepaMergeScheduleFixtureSchema,
  GepaOrchestrationEventOrderFixtureSchema,
  GepaOrchestrationStateTransitionsFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

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

describe("Optimizer.gepa orchestration", () => {
  it.effect("runs merge-check → reflective mutation → acceptance → Pareto update in canonical order", () =>
    Effect.gen(function*() {
      const rawEventOrderFixture = yield* loadFixture("dspy.gepa.orchestration.event-order.seed-0")
      const eventOrderFixture = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
        rawEventOrderFixture
      )
      const rawStateTransitionsFixture = yield* loadFixture("dspy.gepa.orchestration.state-transitions.basic")
      const stateTransitionsFixture = yield* Schema.decodeUnknown(GepaOrchestrationStateTransitionsFixtureSchema)(
        rawStateTransitionsFixture
      )
      const rawMergeScheduleFixture = yield* loadFixture("dspy.gepa.merge.schedule.max-merge-invocations")
      const mergeScheduleFixture = yield* Schema.decodeUnknown(GepaMergeScheduleFixtureSchema)(rawMergeScheduleFixture)
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "Paris" }))
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)
      const events = yield* Stream.runCollect(
        Optimizer.gepaStream({
          module,
          trainset: Arr.make(
            new Example({
              input: { question: "What is the capital of France?" },
              output: { answer: "London" }
            }),
            new Example({
              input: { question: "What is the capital of Japan?" },
              output: { answer: "Berlin" }
            })
          ),
          metric: Metric.exactMatch("answer"),
          maxIterations: 2,
          seed: 42
        })
      ).pipe(Effect.provide(layer))

      const eventList = Arr.fromIterable(events)
      const tags = Arr.map(eventList, (event) => event._tag)

      expect(eventOrderFixture.payload.expectedTerminalTag).toBe("OptimizationCompleted")
      expect(stateTransitionsFixture.payload.expectedCandidateCountProgression.length).toBeGreaterThan(0)
      expect(mergeScheduleFixture.payload.defaultMaxMergeInvocations).toBe(5)

      expect(tags).toContain("IterationStarted")
      expect(tags).toContain("MergeChecked")
      expect(tags).toContain("MutationProposed")
      expect(tags).toContain("AcceptanceEvaluated")
      expect(tags).toContain("ParetoUpdated")
      expect(tags).toContain("OptimizationCompleted")
      expect(tags.indexOf("MergeChecked")).toBeLessThan(tags.indexOf("MutationProposed"))
      expect(tags.indexOf("MutationProposed")).toBeLessThan(tags.indexOf("AcceptanceEvaluated"))
      expect(tags.indexOf("AcceptanceEvaluated")).toBeLessThan(tags.indexOf("ParetoUpdated"))
      expect(
        Option.match(Arr.head(eventList), {
          onNone: () => false,
          onSome: Optimizer.GEPAEvent.$is("IterationStarted")
        })
      ).toBe(true)
      expect(
        Option.match(Arr.last(eventList), {
          onNone: () => false,
          onSome: Optimizer.GEPAEvent.$is("OptimizationCompleted")
        })
      ).toBe(true)
    }))

  it.effect("stores GEPA state in Ref<GEPAState> without SynchronizedRef", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const sourcePath = yield* path.fromFileUrl(new URL("../../../src/optimizers/GEPA/index.ts", import.meta.url))
        .pipe(
          Effect.orDie
        )
      const source = yield* fileSystem.readFileString(sourcePath).pipe(Effect.orDie)

      expect(source.includes("Ref.make(")).toBe(true)
      expect(source.includes("GEPAState")).toBe(true)
      expect(source.includes("SynchronizedRef")).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
