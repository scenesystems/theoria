/**
 * COPRO optimizer contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref, Schema } from "effect"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import {
  BASELINE_INSTRUCTION,
  fullRunResponses,
  IMPROVED_INSTRUCTION,
  makeQaSignature,
  makeSequenceLayer,
  makeTrainset,
  prepareStructuredModule
} from "../helpers/copro.js"
import { CoproProgressionFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

describe("Optimizer.copro", () => {
  it.effect("improves or preserves baseline score on deterministic mock tasks", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.copro.progression.basic")
      const fixture = yield* Schema.decodeUnknown(CoproProgressionFixtureSchema)(rawFixture)
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)

      yield* prepareStructuredModule(module)
      yield* Optimizer.copro({
        module,
        trainset: makeTrainset(),
        metric: Metric.exactMatch("answer"),
        numCandidates: fixture.payload.numCandidates,
        maxSteps: fixture.payload.maxSteps,
        seed: fixture.payload.seed
      }).pipe(Effect.provide(makeSequenceLayer(fullRunResponses())))

      const params = yield* Ref.get(module.params)

      expect(fixture.payload.baselineInstruction).toBe(BASELINE_INSTRUCTION)
      expect(params.instructions).toBe(fixture.payload.expectedBestInstruction)
      expect(params.instructions).toBe(IMPROVED_INSTRUCTION)
      expect(fixture.payload.expectedBestScore).toBeGreaterThanOrEqual(fixture.payload.baselineScore)
    }))
})
