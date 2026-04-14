import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { runObjectiveBenchmark } from "../../benchmark/harness.js"

describe("performance/tpe-history-growth", () => {
  it.live(
    "keeps long-running mixed-space TPE studies inside the documented wall-clock envelope",
    () =>
      Effect.gen(function*() {
        const result = yield* runObjectiveBenchmark()

        expect(result.wallClockMs).toBeLessThan(result.maxWallClockMs)
        expect(result.seedCount).toBeGreaterThan(1)
        expect(result.samples.length).toBe(result.seedCount)
        expect(result.worstWallClockMs).toBeGreaterThanOrEqual(result.wallClockMs)
        expect(result.completedTrialCount).toBe(result.trials)
        expect(result.samplerMetrics.completedCount).toBe(result.trials)
        expect(result.samplerMetrics.pendingCount).toBe(0)
      }),
    45_000
  )
})
