import { describe, expect, it } from "@effect/vitest"
import * as GEPA from "@scenesystems/effect-dsp/GEPA"
import { Array as Arr, Effect, Option, Ref, Schema, Stream } from "effect"

const events = Arr.make(
  GEPA.events.IterationStarted({ iteration: 1, frontierSize: 1 }),
  GEPA.events.AcceptanceEvaluated({
    iteration: 1,
    accepted: false,
    gate1Passed: true,
    fullValsetEvaluated: true,
    previousSubsampleSum: 1,
    mutatedSubsampleSum: 2
  }),
  GEPA.events.ParetoUpdated({
    iteration: 1,
    frontierIndices: Arr.make(0, 1, 2),
    dominatedIndices: Arr.of(3),
    parentWeights: Arr.make({ candidateIndex: 0, weight: 0.75 }, { candidateIndex: 1, weight: 0.25 })
  }),
  GEPA.events.IterationCompleted({ iteration: 1, acceptedCandidate: false, frontierSize: 2 }),
  GEPA.events.OptimizationCompleted({ iterations: 1, bestCandidateId: "candidate-1", frontierSize: 2 })
)

describe("GEPA progress", () => {
  it.effect("taps formatted progress without changing stream events", () =>
    Effect.gen(function*() {
      const lines = yield* Ref.make(Arr.empty<string>())
      const collected = yield* Stream.fromIterable(events).pipe(
        GEPA.tapProgress((line) => Ref.update(lines, Arr.append(line.text))),
        Stream.runCollect
      )
      const output = yield* Ref.get(lines)
      expect(Arr.fromIterable(collected)).toEqual(events)
      expect(output).toHaveLength(5)
      expect(Option.getOrThrow(Arr.last(output))).toBe(
        "OptimizationCompleted iterations=1 bestCandidateId=candidate-1 frontierSize=2"
      )
    }))

  it.effect("separates acceptance, validation gates, and historical frontier size", () =>
    Effect.sync(() => {
      const summary = GEPA.summarizeEvents(events)
      expect(summary.totalEvents).toBe(5)
      expect(summary.acceptanceEvaluatedCount).toBe(1)
      expect(summary.acceptanceAcceptedCount).toBe(0)
      expect(summary.gate1PassedCount).toBe(1)
      expect(summary.fullValsetEvaluatedCount).toBe(1)
      expect(summary.iterationWithAcceptedCandidateCount).toBe(0)
      expect(summary.parentWeightEntriesObserved).toBe(2)
      expect(summary.optimizationBestCandidateId).toBe("candidate-1")
      expect(summary.optimizationFrontierSize).toBe(2)
      expect(summary.maxFrontierSize).toBe(3)
    }))

  it.effect("round-trips optimizer report evidence through JSON", () =>
    Effect.gen(function*() {
      const codec = Schema.fromJsonString(GEPA.Report)
      const encoded = yield* Schema.encodeEffect(codec)(GEPA.summarizeEvents(events))
      const report = yield* Schema.decodeEffect(codec)(encoded)
      expect(report.optimizationBestCandidateId).toBe("candidate-1")
      expect(report.maxFrontierSize).toBe(3)
      expect(report.acceptanceAcceptedCount).toBe(0)
    }))
})
