/**
 * GEPA optimization over a tiny curated benchmark distilled from rejected Amp
 * threads. This is the smallest serious trial: optimize a narrow strategy
 * prompt, not the full coding-agent runtime.
 *
 * Run: bun run examples/22-gepa-amp-thread-strategy-benchmark.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import {
  AMP_THREAD_STRATEGY_EXAMPLE_NAME,
  writeAmpThreadStrategyArtifacts
} from "./shared/amp-thread-strategy-artifacts.js"
import { runAmpThreadStrategyStudy } from "./shared/amp-thread-strategy-study.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(AMP_THREAD_STRATEGY_EXAMPLE_NAME)
  const result = yield* runAmpThreadStrategyStudy
  const artifactPaths = yield* writeAmpThreadStrategyArtifacts(artifacts, result).pipe(
    Effect.provide(artifacts.envelopeContextLayer)
  )

  yield* Effect.log("gepa-amp-thread-strategy-benchmark", {
    benchmarkThreadIds: result.benchmarkThreadIds,
    baselineExecutionScore: result.baselineReport.overallScores.strategyExecution,
    optimizedExecutionScore: result.optimizedReport.overallScores.strategyExecution,
    baselineRubricScore: result.baselineReport.overallScores.strategyRubric,
    optimizedRubricScore: result.optimizedReport.overallScores.strategyRubric,
    finalInstructions: result.finalInstructions,
    eventTags: result.eventTags,
    strategyComparisons: result.strategyComparisons,
    artifactPaths
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer)))
