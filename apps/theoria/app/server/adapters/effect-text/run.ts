import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { effectTextProjectionWidths as widths } from "../../../contracts/capability/effect-text.js"
import { corpus } from "../../../contracts/corpus.js"
import { effectTextEntryDescriptor } from "../../../contracts/entry/descriptors/effect-text.js"
import { entryRunIdentityForId } from "../../../contracts/entry/routing.js"
import type { RunData } from "../../../contracts/study/run.js"
import { baselineLayouts, focusWidth, measured, obstacleProjection, optimizedLayouts } from "./analysis.js"
import { corpusMatrixProjection, corpusProjection, meanNaiveError, widthMetrics } from "./projection.js"
import { runSectionsForStory } from "./stage-story.js"
import { runSummary, streamElements, streamPlan, streamSections } from "./stream.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram, runSummary, streamElements, streamPlan, streamSections }

const effectTextRunIdentity = entryRunIdentityForId(effectTextEntryDescriptor.entryId)

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const { baseline, optimized, obstacles, runnableProgram } = yield* Effect.all({
    baseline: measured(baselineLayouts),
    optimized: measured(optimizedLayouts),
    obstacles: obstacleProjection,
    runnableProgram: preloadProgram
  })
  const endedAt = yield* Clock.currentTimeMillis

  const naiveLineErrorMean = meanNaiveError(optimized.value)
  const projectedCorpus = corpusProjection(optimized.value, corpus, focusWidth)
  const projectedMatrix = corpusMatrixProjection(optimized.value, corpus, widths)
  const widthMetricSnapshot = widthMetrics(optimized.value, widths)

  return {
    ...effectTextRunIdentity,
    summary: runSummary,
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: runSectionsForStory({
      baselineDurationMs: baseline.durationMs,
      naiveLineErrorMean,
      obstacleProjection: obstacles,
      optimizedDurationMs: optimized.durationMs,
      projectedMatrix,
      sampleLabel: projectedCorpus.at(0)?.label ?? "none",
      widthMetricSnapshot
    })
  }
})
