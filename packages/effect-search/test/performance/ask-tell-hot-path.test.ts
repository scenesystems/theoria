import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { runEngineBenchmark } from "../../benchmark/harness.js"

describe("performance/ask-tell-hot-path", () => {
  it.live(
    "keeps Study.ask and Study.tell bounded after large completed-trial histories",
    () =>
      Effect.gen(function*() {
        const result = yield* runEngineBenchmark()

        expect(result.longAskAverageMs).toBeLessThan(result.maxLongAskAverageMs)
        expect(result.longTellAverageMs).toBeLessThan(result.maxLongTellAverageMs)
        expect(result.askGrowthFactor).toBeLessThan(result.maxAskGrowthFactor)
        expect(result.tellGrowthFactor).toBeLessThan(result.maxTellGrowthFactor)
        expect(result.seedCount).toBeGreaterThan(1)
        expect(result.samples.length).toBe(result.seedCount)
        expect(result.worstLongAskAverageMs).toBeGreaterThanOrEqual(result.longAskAverageMs)
        expect(result.worstLongTellAverageMs).toBeGreaterThanOrEqual(result.longTellAverageMs)
        expect(result.samplerMetrics.pendingCount).toBe(0)
      }),
    45_000
  )
})
