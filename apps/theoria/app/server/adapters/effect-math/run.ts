import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { effectMathEntryDescriptor } from "../../../contracts/entry/descriptors/effect-math.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { RunData } from "../../../contracts/study/run.js"
import { preloadProgram } from "./preload.js"
import {
  computeDistributionGeometry,
  computeInferenceSummary,
  computePowerBySampleSize,
  computePowerCurves,
  computeRequiredNGrid,
  computeSensitivity,
  computeSolverStatus,
  configurationSection,
  defaultEffectMathStreamRequest,
  runSummary,
  streamElements,
  streamPlan,
  streamSections
} from "./stream.js"

export { preloadProgram, runSummary, streamElements, streamPlan, streamSections }

const effectMathRunIdentity = EntryRunIdentity.project(effectMathEntryDescriptor)

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis

  const [sensitivity, bySampleSize, requiredGrid, curves, geometry, inferenceSummary, solverStatus] = yield* Effect.all(
    [
      computeSensitivity(defaultEffectMathStreamRequest),
      computePowerBySampleSize(defaultEffectMathStreamRequest),
      computeRequiredNGrid,
      computePowerCurves(defaultEffectMathStreamRequest),
      computeDistributionGeometry(defaultEffectMathStreamRequest),
      computeInferenceSummary(defaultEffectMathStreamRequest),
      computeSolverStatus(defaultEffectMathStreamRequest)
    ]
  )

  const runnableProgram = yield* preloadProgram
  const endedAt = yield* Clock.currentTimeMillis

  return {
    ...effectMathRunIdentity,
    summary: runSummary,
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      sensitivity,
      bySampleSize,
      requiredGrid,
      curves,
      geometry,
      inferenceSummary,
      solverStatus,
      configurationSection(defaultEffectMathStreamRequest)
    ]
  }
})
