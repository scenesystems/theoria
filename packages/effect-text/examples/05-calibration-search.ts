/**
 * Runs a seeded calibration optimization over a checked expected-layout corpus and
 * reports the selected profile with its resumable snapshot.
 *
 * Run with `bun run packages/effect-text/examples/05-calibration-search.ts`.
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Sampler } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Option } from "effect"

import { Calibration } from "@scenesystems/effect-text"

import { calibrationServices, canonicalCalibrationCases, exploratorySearch } from "./live/calibrationFixtures.js"

const program = Effect.gen(function*() {
  const optimized = yield* Calibration.optimize({
    cases: canonicalCalibrationCases,
    services: calibrationServices,
    trials: 4,
    sampler: Sampler.random({ seed: 91 }),
    search: exploratorySearch
  })

  yield* Effect.log("calibration search", {
    bestProfile: optimized.bestProfile,
    bestReport: optimized.bestReport,
    bestValue: optimized.optimizationResult.bestTrial.state.value,
    bestLossSummary: optimized.optimization.bestLossSummary,
    firstEvent: Arr.head(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag)),
    lastEvent: Arr.last(optimized.optimization.artifacts.eventLog).pipe(Option.map((event) => event._tag)),
    eventCount: Arr.length(optimized.optimization.artifacts.eventLog),
    snapshotNextTrialNumber: optimized.optimization.artifacts.snapshot.nextTrialNumber
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
