/**
 * BootstrapFewShot progress formatting and summary contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Optimizer from "@scenesystems/effect-dsp/Optimizer"
import { Array as Arr, Effect, Stream } from "effect"

describe("Optimizer.bootstrapFewShot progress", () => {
  it.effect("formats fallback lifecycle events with deterministic detail text", () =>
    Effect.sync(() => {
      const activated = Optimizer.formatBootstrapEvent(
        Optimizer.BootstrapEvent.BootstrapFallbackActivated({
          threshold: 1,
          roundsAttempted: 1,
          acceptedTraces: 0,
          rejectedTraces: 2,
          bestScoreSeen: true,
          bestScore: 0,
          averageScore: 0,
          fallbackLabeledDemoCount: 3
        })
      )
      const completed = Optimizer.formatBootstrapEvent(
        Optimizer.BootstrapEvent.BootstrapCompleted({
          totalDemos: 3,
          roundsUsed: 1,
          fallbackUsed: true
        })
      )

      expect(activated.tag).toBe("BootstrapFallbackActivated")
      expect(activated.text).toBe(
        "BootstrapFallbackActivated threshold=1 roundsAttempted=1 acceptedTraces=0 rejectedTraces=2 bestScoreSeen=true bestScore=0 averageScore=0 fallbackLabeledDemoCount=3"
      )
      expect(completed.tag).toBe("BootstrapCompleted")
      expect(completed.text).toBe("BootstrapCompleted totalDemos=3 roundsUsed=1 fallbackUsed=true")
    }))

  it.effect("deduplicates repeated progress lines without dropping a changed score", () =>
    Effect.gen(function*() {
      const lines = yield* Stream.make(
        Optimizer.BootstrapEvent.TraceAccepted({ moduleName: "qa", score: 0.5 }),
        Optimizer.BootstrapEvent.TraceAccepted({ moduleName: "qa", score: 0.5 }),
        Optimizer.BootstrapEvent.TraceAccepted({ moduleName: "qa", score: 0.8 })
      ).pipe(
        Stream.map(Optimizer.formatBootstrapEvent),
        Stream.changes,
        Stream.map((line) => line.text),
        Stream.runCollect
      )

      expect(Arr.fromIterable(lines)).toEqual(Arr.make(
        "TraceAccepted module=qa score=0.5",
        "TraceAccepted module=qa score=0.8"
      ))
    }))

  it.effect("summarizes fallback-aware bootstrap event streams", () =>
    Effect.sync(() => {
      const events = Arr.make(
        Optimizer.BootstrapEvent.RoundStarted({ round: 1, maxRounds: 2 }),
        Optimizer.BootstrapEvent.TraceRejected({ moduleName: "qa", score: 0, threshold: 1 }),
        Optimizer.BootstrapEvent.RoundCompleted({ round: 1, demosCollected: 0 }),
        Optimizer.BootstrapEvent.BootstrapFallbackActivated({
          threshold: 1,
          roundsAttempted: 1,
          acceptedTraces: 0,
          rejectedTraces: 1,
          bestScoreSeen: true,
          bestScore: 0,
          averageScore: 0,
          fallbackLabeledDemoCount: 2
        }),
        Optimizer.BootstrapEvent.BootstrapFallbackCompleted({
          fallbackDemosAdded: 2,
          totalDemos: 2,
          roundsUsed: 1
        }),
        Optimizer.BootstrapEvent.BootstrapCompleted({
          totalDemos: 2,
          roundsUsed: 1,
          fallbackUsed: true
        })
      )
      const summary = Optimizer.summarizeBootstrapEvents(events)

      expect(summary.totalEvents).toBe(6)
      expect(summary.roundsStarted).toBe(1)
      expect(summary.roundsCompleted).toBe(1)
      expect(summary.traceRejectedCount).toBe(1)
      expect(summary.fallbackActivatedSeen).toBe(true)
      expect(summary.fallbackCompletedSeen).toBe(true)
      expect(summary.completedSeen).toBe(true)
      expect(summary.fallbackUsed).toBe(true)
      expect(summary.totalDemos).toBe(2)
      expect(summary.roundsUsed).toBe(1)
    }))
})
