/**
 * COPRO progress contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema, Stream } from "effect"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import {
  capitalCityQaSignature,
  capitalCityTrainset,
  fullRunResponses,
  prepareStructuredModule,
  SequenceLanguageModel
} from "../helpers/copro.js"
import { CoproProgressionFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

describe("Optimizer.copro progress", () => {
  it.effect("keeps event and summary surfaces deterministic and serializable", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.copro.progression.basic")
      const fixture = yield* Schema.decodeUnknown(CoproProgressionFixtureSchema)(rawFixture)
      const signature = yield* capitalCityQaSignature
      const module = yield* Module.predict("qa", signature)

      yield* prepareStructuredModule(module)
      const events = yield* Stream.runCollect(
        Optimizer.coproStream({
          module,
          trainset: capitalCityTrainset,
          metric: Metric.exactMatch("answer"),
          numCandidates: fixture.payload.numCandidates,
          maxSteps: fixture.payload.maxSteps,
          seed: fixture.payload.seed
        })
      ).pipe(Effect.provide(SequenceLanguageModel.layer(fullRunResponses)))

      const eventList = yield* Schema.decodeUnknown(Schema.Array(Optimizer.COPROEventSchema))(Arr.fromIterable(events))
      const summary = Optimizer.COPROEventSummary.summarize(eventList)

      expect(Optimizer.COPROProgressLine.project(eventList[0]!).text).toContain("OptimizationStarted")
      expect(summary.stepsStarted).toBe(fixture.payload.maxSteps)
      expect(summary.candidateCount).toBe(fixture.payload.trials.length)
      expect(summary.trialsEvaluated).toBe(fixture.payload.trials.length)
      expect(summary.completed).toBe(true)
      expect(summary.bestScore).toBe(fixture.payload.expectedBestScore)
      expect(yield* Schema.decodeUnknown(Optimizer.COPROEventSchema)(eventList[0]!)).toEqual(eventList[0])
    }))
})
