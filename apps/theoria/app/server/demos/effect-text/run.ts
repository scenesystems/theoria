import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { corpus } from "../../../contracts/corpus.js"
import { effectTextProjectionWidths as widths } from "../../../contracts/demo/text.js"
import type { RunData } from "../../../contracts/run.js"
import { baselineLayouts, focusWidth, measured, obstacleProjection, optimizedLayouts } from "./analysis.js"
import { corpusMatrixProjection, corpusProjection, meanNaiveError, widthMetrics } from "./projection.js"
import { runSectionsForStory } from "./stage-story.js"
import { streamElements, streamSections } from "./stream.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram, streamElements, streamSections }

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
    id: "effect-text",
    packageName: "effect-text",
    summary:
      "Browser-backed measurement, prepared-handle reuse, obstacle-aware reflow, and optional calibration work — all grounded in the shipped effect-text browser and React surfaces.",
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
