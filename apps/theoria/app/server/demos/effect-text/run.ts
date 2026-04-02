import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { corpus } from "../../../contracts/corpus.js"
import { effectTextProjectionWidths as widths } from "../../../contracts/demo/text.js"
import type { RunData } from "../../../contracts/run.js"
import { baselineLayouts, focusWidth, measured, obstacleProjection, optimizedLayouts } from "./analysis.js"
import { corpusMatrixProjection, corpusProjection, meanNaiveError, widthMetrics } from "./projection.js"
import {
  corpusMatrixSection,
  corpusSection,
  obstacleSection,
  performanceSection,
  widthMetricsSection
} from "./sections.js"
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
      "effect-text proved that text layout is amortized preparation plus pure projection — one prepared handle per corpus entry, then every width and obstacle variant becomes arithmetic.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      performanceSection({
        baselineDurationMs: baseline.durationMs,
        optimizedDurationMs: optimized.durationMs,
        naiveLineErrorMean
      }),
      obstacleSection(obstacles),
      corpusSection(projectedCorpus.at(0)?.label ?? "none"),
      corpusMatrixSection(projectedMatrix),
      widthMetricsSection(widthMetricSnapshot)
    ]
  }
})
