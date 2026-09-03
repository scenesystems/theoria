/**
 * Runs a seeded calibration study over a checked expected-layout corpus and
 * reports the selected profile with its resumable snapshot.
 *
 * Run with `bun run packages/effect-text/examples/05-experimental-calibration-search.ts`.
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Sampler } from "@scenesystems/effect-search"
import { Effect } from "effect"

import { Experimental } from "@scenesystems/effect-text"

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
