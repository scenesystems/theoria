import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { runBenchmarkSuite, validateBenchmarkArtifact } from "../../benchmark/harness.js"
import { BenchmarkArtifactSchema, BenchmarkSuitePlanSchema } from "../../benchmark/schema.js"

const contractSuitePlan = Schema.decodeUnknownSync(BenchmarkSuitePlanSchema)({
  sampler: {
    caseId: "sampler-suggestion-growth",
    seeds: [2701, 2713],
    shortHistoryLength: 2,
    longHistoryLength: 4,
    runsPerSeed: 1,
    maxLongAverageMs: 20_000,
    maxGrowthFactor: 20
  },
  engine: {
    caseId: "ask-tell-hot-path",
    seeds: [2701, 2713],
    shortHistoryLength: 2,
    longHistoryLength: 4,
    measurementCycles: 1,
    maxLongAskAverageMs: 20_000,
    maxLongTellAverageMs: 20_000,
    maxAskGrowthFactor: 20,
    maxTellGrowthFactor: 20
  },
  objective: {
    caseId: "tpe-history-growth",
    seeds: [811, 823],
    trials: 10,
    maxWallClockMs: 20_000
  }
})

describe("performance/benchmark-artifact", () => {
  it.live(
    "emits one canonical artifact with separated engine, sampler, and objective timings",
    () =>
      Effect.gen(function*() {
        const artifact = yield* runBenchmarkSuite(contractSuitePlan)
        const decoded = yield* Schema.decodeUnknown(BenchmarkArtifactSchema)(artifact, {
          onExcessProperty: "error"
        })

        expect(decoded.suiteVersion).toBe(2)
        expect(decoded.aggregationKind).toBe("mean-of-seeds")
        expect(decoded.sampler.timingKind).toBe("sampler")
        expect(decoded.engine.timingKind).toBe("engine")
        expect(decoded.objective.timingKind).toBe("objective")
        expect(decoded.sampler.seedCount).toBe(2)
        expect(decoded.sampler.samples.length).toBe(decoded.sampler.seedCount)
        expect(decoded.engine.seedCount).toBe(2)
        expect(decoded.engine.samples.length).toBe(decoded.engine.seedCount)
        expect(decoded.objective.seedCount).toBe(2)
        expect(decoded.objective.samples.length).toBe(decoded.objective.seedCount)
        expect(decoded.engine.samplerMetrics.pendingCount).toBe(0)
        expect(decoded.objective.samplerMetrics.completedCount).toBe(decoded.objective.trials)
        expect(decoded.objective.worstWallClockMs).toBeGreaterThanOrEqual(decoded.objective.wallClockMs)
        expect(validateBenchmarkArtifact(decoded)).toEqual([])
      }),
    30_000
  )
})
