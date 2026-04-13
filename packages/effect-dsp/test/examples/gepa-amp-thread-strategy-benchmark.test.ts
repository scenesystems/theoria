/**
 * Example contract: curated Amp-thread strategy benchmark.
 */
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"
import { loadAmpThreadStrategyBenchmarkDataset } from "../../examples/shared/amp-thread-strategy-benchmark.js"
import {
  BAD_STRATEGY,
  GOOD_STRATEGY,
  IMPROVED_INSTRUCTION,
  runAmpThreadStrategyStudy
} from "../../examples/shared/amp-thread-strategy-study.js"

const ImplementationStrategy = Experimental.OpenAgentTrace.ImplementationStrategy

describe("examples/22-gepa-amp-thread-strategy-benchmark", () => {
  it.effect("improves the strategy rubric score on the curated thread benchmark", () =>
    Effect.gen(function*() {
      const benchmarkDataset = yield* loadAmpThreadStrategyBenchmarkDataset()
      const result = yield* runAmpThreadStrategyStudy
      const firstComparison = result.strategyComparisons[0]

      expect(benchmarkDataset.surfaceId).toBe(ImplementationStrategy.surfaceId)
      expect(benchmarkDataset.cases).toHaveLength(8)
      expect(result.benchmarkCaseIds).toEqual(benchmarkDataset.cases.map((promptCase) => promptCase.caseId))
      expect(result.benchmarkThreadIds).toEqual(benchmarkDataset.cases.map((promptCase) => promptCase.task.sessionId))
      expect(result.splitSummary).toEqual({ train: 3, validation: 3, holdout: 2 })
      expect(result.optimizedReport.overallScores.strategyExecution ?? 0).toBeGreaterThan(
        result.baselineReport.overallScores.strategyExecution ?? 0
      )
      expect(result.finalInstructions).toBe(IMPROVED_INSTRUCTION)
      expect(result.eventTags).toContain("MutationProposed")
      expect(result.eventTags).toContain("AcceptanceEvaluated")
      expect(result.eventTags).toContain("OptimizationCompleted")
      expect(result.strategyComparisons).toHaveLength(2)
      expect(firstComparison?.baselineStrategy).toBe(BAD_STRATEGY)
      expect(firstComparison?.optimizedStrategy).toBe(GOOD_STRATEGY)
      expect(firstComparison?.baselineFeedback.length).toBeGreaterThan(0)
      expect(firstComparison?.optimizedFeedback.length).toBeGreaterThan(0)
      expect(firstComparison?.optimizedScore ?? 0).toBeGreaterThan(firstComparison?.baselineScore ?? 0)
    }).pipe(Effect.provide(BunContext.layer)))
})
