import { Effect } from "effect"
import * as Arr from "effect/Array"

import { effectTextProjectionWidths as widths } from "../../../contracts/capability/effect-text.js"
import { corpus } from "../../../contracts/corpus.js"
import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence/item.js"
import { legalPolicyScene } from "../../../contracts/presentation/reflow-scenes.js"
import {
  type CachedEffectTextMeasurements,
  focusWidth,
  type ObstacleProjection,
  sampleCorpusLabel
} from "./analysis.js"
import {
  type CorpusMatrixEntry,
  corpusMatrixProjection,
  meanNaiveError,
  type WidthMetric,
  widthMetrics
} from "./projection.js"

const projectedLayoutCount = corpus.length * widths.length
const optimizedPrepareCalls = corpus.length
const baselinePrepareCalls = projectedLayoutCount
const prepareReuseRatio = projectedLayoutCount / Math.max(1, optimizedPrepareCalls)
const eliminatedPrepareCalls = baselinePrepareCalls - optimizedPrepareCalls
const obstacleDefinitions = legalPolicyScene.obstacles

export const performanceSection = ({
  baselineDurationMs,
  optimizedDurationMs,
  naiveLineErrorMean
}: {
  readonly baselineDurationMs: number
  readonly optimizedDurationMs: number
  readonly naiveLineErrorMean: number
}): EvidenceSection => ({
  title: "Performance",
  items: [
    {
      _tag: "Comparison",
      label: "Projection runtime",
      baseline: baselineDurationMs,
      improved: optimizedDurationMs,
      unit: "ms",
      direction: "lower-is-better"
    },
    {
      _tag: "Comparison",
      label: "Prepare calls",
      baseline: baselinePrepareCalls,
      improved: optimizedPrepareCalls,
      unit: "prepares",
      direction: "lower-is-better"
    },
    {
      _tag: "Scalar",
      label: "Layouts per prepared handle",
      value: prepareReuseRatio,
      unit: "layouts/handle",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Prepare calls eliminated",
      value: eliminatedPrepareCalls,
      unit: "prepares",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Speedup",
      value: baselineDurationMs / Math.max(1, optimizedDurationMs),
      unit: "×",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Naive line error (mean)",
      value: naiveLineErrorMean,
      unit: "lines",
      format: "fixed"
    }
  ]
})

export const obstacleSection = ({ lineCount, obstacleCount }: ObstacleProjection): EvidenceSection => ({
  title: "Obstacle Reflow",
  items: [
    {
      _tag: "Scalar",
      label: "Baseline lines",
      value: lineCount,
      unit: "lines",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Obstacles",
      value: obstacleCount,
      unit: "obstacles",
      format: "integer"
    },
    {
      _tag: "Text",
      label: "Proof",
      value:
        "The interactive stage reuses a prepared handle, then projects width changes and anchored obstacle bands with pure arithmetic — no CSS float fallback, no browser re-measurement."
    }
  ]
})

export const corpusSection = (sampleLabel: string): EvidenceSection => ({
  title: "Corpus",
  items: [
    { _tag: "Scalar", label: "Entries", value: corpus.length, unit: "entries", format: "integer" },
    { _tag: "Scalar", label: "Widths per entry", value: widths.length, unit: "widths", format: "integer" },
    { _tag: "Scalar", label: "Focus width", value: focusWidth, unit: "px", format: "integer" },
    {
      _tag: "Scalar",
      label: "Projected layouts",
      value: projectedLayoutCount,
      unit: "layouts",
      format: "integer"
    },
    { _tag: "Text", label: "Sample corpus label", value: sampleLabel },
    {
      _tag: "Scalar",
      label: "Obstacle count",
      value: obstacleDefinitions.length,
      unit: "obstacles",
      format: "integer"
    }
  ]
})

export const corpusOverviewSection = corpusSection(sampleCorpusLabel)
export const corpusOverviewSectionEffect = Effect.succeed(corpusOverviewSection)

export const corpusMatrixSection = (projectedMatrix: ReadonlyArray<CorpusMatrixEntry>): EvidenceSection => ({
  title: "Corpus Matrix",
  items: [
    {
      _tag: "Table",
      label: "Corpus projections",
      columns: [
        "Entry",
        "Characters",
        ...Arr.map(widths, (width) => `${width}px measured`),
        ...Arr.map(widths, (width) => `${width}px naive`)
      ],
      rows: Arr.map(projectedMatrix, (entry) => {
        const measuredCols = Arr.map(entry.projections, (projection) => String(projection.measuredLineCount))
        const naiveCols = Arr.map(entry.projections, (projection) => String(projection.naiveLineCount))

        return [entry.label, String(entry.characters), ...measuredCols, ...naiveCols]
      })
    }
  ]
})

export const widthMetricsSection = (widthMetricSnapshot: ReadonlyArray<WidthMetric>): EvidenceSection => ({
  title: "Width Metrics",
  items: Arr.map(widthMetricSnapshot, (metric): EvidenceItem => ({
    _tag: "Text",
    label: `Width ${metric.width}`,
    value: `${metric.meanMeasuredLineCount.toFixed(2)} measured / ${metric.meanNaiveLineCount.toFixed(2)} naive (MAE ${
      metric.meanAbsoluteLineError.toFixed(4)
    })`
  }))
})

export const obstacleSectionEffect = (
  measurements: CachedEffectTextMeasurements
): Effect.Effect<EvidenceSection, unknown, never> => measurements.getObstacles.pipe(Effect.map(obstacleSection))

export const performanceSectionEffect = (
  measurements: CachedEffectTextMeasurements
): Effect.Effect<EvidenceSection, unknown, never> =>
  Effect.gen(function*() {
    const baseline = yield* measurements.getBaseline
    const optimized = yield* measurements.getOptimized

    return performanceSection({
      baselineDurationMs: baseline.durationMs,
      optimizedDurationMs: optimized.durationMs,
      naiveLineErrorMean: meanNaiveError(optimized.value)
    })
  })

export const corpusMatrixSectionEffects = (
  measurements: CachedEffectTextMeasurements
): ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>> => [
  measurements.getOptimized.pipe(
    Effect.map((optimized) => corpusMatrixSection(corpusMatrixProjection(optimized.value, corpus, widths)))
  ),
  measurements.getOptimized.pipe(
    Effect.map((optimized) => widthMetricsSection(widthMetrics(optimized.value, widths)))
  )
]
