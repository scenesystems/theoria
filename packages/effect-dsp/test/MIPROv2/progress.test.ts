import { describe, expect, it } from "@effect/vitest"
import * as MIPROv2 from "@scenesystems/effect-dsp/MIPROv2"
import { Array as Arr, Effect, Ref, Stream } from "effect"

const events = Arr.make(
  MIPROv2.events.Phase3Started({ numTrials: 6 }),
  MIPROv2.events.TrialEvaluated({ trial: 0, score: 0.4 }),
  MIPROv2.events.FullEvalCompleted({ bestScore: 0.7 }),
  MIPROv2.events.TrialEvaluated({ trial: 1, score: 0.8 }),
  MIPROv2.events.Phase3Completed({ bestScore: 0.75, totalTrials: 6 })
)

describe("MIPROv2 progress", () => {
  it.effect("taps formatted progress in order without changing stream events", () =>
    Effect.gen(function*() {
      const lines = yield* Ref.make(Arr.empty<string>())
      const collected = yield* Stream.fromIterable(events).pipe(
        MIPROv2.tapProgress((line) => Ref.update(lines, Arr.append(line.text))),
        Stream.runCollect
      )
      expect(Arr.fromIterable(collected)).toEqual(events)
      expect(yield* Ref.get(lines)).toEqual(Arr.make(
        "Phase3Started numTrials=6",
        "TrialEvaluated trial=0 score=0.4",
        "FullEvalCompleted bestScore=0.7",
        "TrialEvaluated trial=1 score=0.8",
        "Phase3Completed bestScore=0.75 totalTrials=6"
      ))
    }))

  it.effect("distinguishes configured, observed, and completed trials and retains the highest search score", () =>
    Effect.sync(() => {
      const summary = MIPROv2.summarizeEvents(events)
      expect(summary.totalEvents).toBe(5)
      expect(summary.phase3ConfiguredTrials).toBe(6)
      expect(summary.trialEvaluatedCount).toBe(2)
      expect(summary.fullEvalCompletedCount).toBe(1)
      expect(summary.phase3CompletedTrials).toBe(6)
      expect(summary.phase3BestScoreSeen).toBe(true)
      expect(summary.phase3BestScore).toBe(0.8)
    }))

  it.effect("separates learned demonstrations and retained gain from search quality", () =>
    Effect.sync(() => {
      const eventSummary = MIPROv2.summarizeEvents(events)
      const outcome = MIPROv2.summarizeOutcome({
        baselineScore: 0.2,
        optimizedScore: 0.6,
        demoCountBefore: 1,
        demoCountAfter: 3,
        events: eventSummary
      })
      const observability = MIPROv2.summarizeOptimization({
        baselineScore: 0.5,
        optimizedScore: 0.5,
        eventSummary
      })
      expect(outcome.scoreDelta).toBeCloseTo(0.4, 15)
      expect(outcome.demosLearnedDuringMIPROv2).toBe(2)
      expect(observability.searchBestScore).toBe(0.8)
      expect(observability.searchGain).toBeCloseTo(0.3, 15)
      expect(observability.retainedGain).toBe(0)
      expect(observability.retainedVsSearchGap).toBeCloseTo(0.3, 15)
      expect(observability.searchImprovedButRetainedFlat).toBe(true)
    }))

  it.effect("uses the retained score when no search score was observed", () =>
    Effect.sync(() => {
      const observability = MIPROv2.summarizeOptimization({
        baselineScore: 0.25,
        optimizedScore: 0.5,
        eventSummary: MIPROv2.summarizeEvents(Arr.make(MIPROv2.events.Phase1Started({ numCandidates: 1 })))
      })
      expect(observability.searchBestScoreSeen).toBe(false)
      expect(observability.searchBestScore).toBe(0.5)
      expect(observability.searchGain).toBe(0.25)
      expect(observability.retainedGain).toBe(0.25)
      expect(observability.retainedVsSearchGap).toBe(0)
      expect(observability.searchImprovedButRetainedFlat).toBe(false)
    }))
})
