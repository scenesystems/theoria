/**
 * BootstrapFewShot progress formatting and summary contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr } from "effect"
import * as Optimizer from "effect-dsp/Optimizer"

describe("Optimizer.bootstrapFewShot progress", () => {
  it("formats fallback lifecycle events with deterministic detail text", () => {
    const activated = Optimizer.BootstrapProgressLine.project(
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
    const completed = Optimizer.BootstrapProgressLine.project(
      Optimizer.BootstrapEvent.BootstrapCompleted({
        totalDemos: 3,
        roundsUsed: 1,
        fallbackUsed: true
      })
    )

    expect(activated.tag).toBe("BootstrapFallbackActivated")
    expect(activated.text).toContain("fallbackLabeledDemoCount=3")
    expect(completed.tag).toBe("BootstrapCompleted")
    expect(completed.text).toContain("fallbackUsed=true")
  })

  it("summarizes fallback-aware bootstrap event streams", () => {
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
    const summary = Optimizer.BootstrapEventSummary.summarize(events)

    expect(summary.totalEvents).toBe(6)
    expect(summary.traceRejectedCount).toBe(1)
    expect(summary.fallbackActivatedSeen).toBe(true)
    expect(summary.fallbackCompletedSeen).toBe(true)
    expect(summary.completedSeen).toBe(true)
    expect(summary.fallbackUsed).toBe(true)
    expect(summary.totalDemos).toBe(2)
    expect(summary.roundsUsed).toBe(1)
  })
})
