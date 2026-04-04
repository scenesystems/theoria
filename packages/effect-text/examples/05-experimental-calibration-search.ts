/**
 * Experimental Calibration Search — optimize an engine profile with effect-search.
 *
 * What this shows: `Experimental.Calibration.optimizeProfile` composes the
 * calibration corpus with `effect-search` while keeping the core Text APIs
 * unchanged.
 *
 * Feature Type Links:
 * - {@link Experimental.Calibration.optimizeProfile}
 * - {@link Experimental.Calibration.CalibrationReportType}
 * - {@link Sampler.Sampler}
 *
 * Run: bun run packages/effect-text/examples/05-experimental-calibration-search.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"
import { Sampler } from "effect-search"

import { Experimental } from "effect-text"

import {
  calibrationServices,
  canonicalCalibrationCases,
  exploratorySearchDescriptor
} from "./live/calibrationFixtures.js"

const program = Effect.gen(function*() {
  const optimized = yield* Experimental.Calibration.optimizeProfile({
    cases: canonicalCalibrationCases,
    services: calibrationServices,
    trials: 4,
    sampler: Sampler.random({ seed: 91 }),
    searchDescriptor: exploratorySearchDescriptor
  })

  yield* Effect.log("experimental calibration search", {
    bestProfile: optimized.bestProfile,
    bestReport: optimized.bestReport,
    bestValue: optimized.studyResult.bestTrial.state.value,
    bestLossSummary: optimized.optimization.bestLossSummary,
    firstEvent: optimized.optimization.artifacts.eventLog[0]?._tag,
    lastEvent: optimized.optimization.artifacts.eventLog.at(-1)?._tag,
    eventCount: optimized.optimization.artifacts.eventLog.length,
    snapshotNextTrialNumber: optimized.optimization.artifacts.snapshot.nextTrialNumber
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
