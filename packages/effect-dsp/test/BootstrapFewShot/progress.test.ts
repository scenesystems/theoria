/**
 * BootstrapFewShot progress formatting and summary contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as BootstrapFewShot from "@scenesystems/effect-dsp/BootstrapFewShot"
import { Array as Arr, Effect, Stream } from "effect"

describe("BootstrapFewShot.run progress", () => {
  it.effect("formats labeled completion with deterministic detail text", () =>
    Effect.sync(() => {
      const completed = BootstrapFewShot.formatEvent(
        BootstrapFewShot.events.BootstrapCompleted({
          totalDemos: 3,
          roundsUsed: 1,
          labeledCount: 2
        })
      )

      expect(completed.tag).toBe("BootstrapCompleted")
      expect(completed.text).toBe("BootstrapCompleted totalDemos=3 roundsUsed=1 labeledCount=2")
    }))

  it.effect("deduplicates repeated progress lines without dropping a changed score", () =>
    Effect.gen(function*() {
      const lines = yield* Stream.make(
        BootstrapFewShot.events.TraceAccepted({ moduleName: "qa", score: 0.5 }),
        BootstrapFewShot.events.TraceAccepted({ moduleName: "qa", score: 0.5 }),
        BootstrapFewShot.events.TraceAccepted({ moduleName: "qa", score: 0.8 })
      ).pipe(
        Stream.map(BootstrapFewShot.formatEvent),
        Stream.changes,
        Stream.map((line) => line.text),
        Stream.runCollect
      )

      expect(Arr.fromIterable(lines)).toEqual(Arr.make(
        "TraceAccepted module=qa score=0.5",
        "TraceAccepted module=qa score=0.8"
      ))
    }))

  it.effect("summarizes rejected traces and labeled completion", () =>
    Effect.sync(() => {
      const events = Arr.make(
        BootstrapFewShot.events.RoundStarted({ round: 1, maxRounds: 2 }),
        BootstrapFewShot.events.TraceRejected({ moduleName: "qa", score: 0, threshold: 1 }),
        BootstrapFewShot.events.RoundCompleted({ round: 1, demosCollected: 0 }),
        BootstrapFewShot.events.BootstrapCompleted({
          totalDemos: 2,
          roundsUsed: 1,
          labeledCount: 2
        })
      )
      const summary = BootstrapFewShot.summarizeEvents(events)

      expect(summary.totalEvents).toBe(4)
      expect(summary.roundsStarted).toBe(1)
      expect(summary.roundsCompleted).toBe(1)
      expect(summary.traceRejectedCount).toBe(1)
      expect(summary.completedSeen).toBe(true)
      expect(summary.labeledCount).toBe(2)
      expect(summary.totalDemos).toBe(2)
      expect(summary.roundsUsed).toBe(1)
    }))
})
