/**
 * Amp implementation-strategy study over the curated checked-in corpus.
 *
 * Run: bun run examples/24-amp-implementation-strategy-study.ts
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import {
  AMP_IMPLEMENTATION_STRATEGY_STUDY_EXAMPLE_NAME,
  writeAmpThreadStrategyArtifacts
} from "./shared/amp-thread-strategy-artifacts.js"
import { runAmpThreadStrategyStudy } from "./shared/amp-thread-strategy-study.js"
import { createExampleArtifacts, noopArtifactSinkLayer } from "./shared/output-artifacts.js"

const program = Effect.gen(function*() {
  const artifacts = yield* createExampleArtifacts(AMP_IMPLEMENTATION_STRATEGY_STUDY_EXAMPLE_NAME)
  const result = yield* runAmpThreadStrategyStudy
  const artifactPaths = yield* writeAmpThreadStrategyArtifacts(
    artifacts,
    result,
    AMP_IMPLEMENTATION_STRATEGY_STUDY_EXAMPLE_NAME
  ).pipe(Effect.provide(artifacts.envelopeContextLayer))

  yield* Effect.log("amp-implementation-strategy-study", {
    benchmarkThreadIds: result.benchmarkThreadIds,
    splitSummary: result.splitSummary,
    baselineExecutionScore: result.baselineReport.overallScores.strategyExecution,
    optimizedExecutionScore: result.optimizedReport.overallScores.strategyExecution,
    finalInstructions: result.finalInstructions,
    strategyComparisons: result.strategyComparisons,
    artifactPaths
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(noopArtifactSinkLayer), Effect.provide(BunContext.layer)))
