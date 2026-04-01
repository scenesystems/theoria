import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Option, Stream } from "effect"
import * as Arr from "effect/Array"

import { Text } from "effect-text"
import type { EvidenceItem, EvidenceSection } from "../../../contracts/evidence.js"
import { legalPolicyScene } from "../../../contracts/reflow-scenes.js"
import type { RunData } from "../../../contracts/run.js"

import { corpus, type CorpusEntry, widths } from "./corpus.js"
import {
  type CorpusMatrixEntry,
  corpusMatrixProjection,
  corpusProjection,
  type LayoutProjection,
  meanNaiveError,
  type WidthMetric,
  widthMetrics
} from "./projection.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram }

const focusWidth = 220
const projectedLayoutCount = corpus.length * widths.length
const optimizedPrepareCalls = corpus.length
const baselinePrepareCalls = projectedLayoutCount
const prepareReuseRatio = projectedLayoutCount / Math.max(1, optimizedPrepareCalls)
const eliminatedPrepareCalls = baselinePrepareCalls - optimizedPrepareCalls
const obstacleDefinitions = legalPolicyScene.obstacles

const textInput = (text: string): Text.PrepareInputType => ({
  text,
  font: { family: "Avenir", size: 16, weight: 400 },
  whiteSpace: "normal"
})

const projectLayout = (
  id: string,
  label: string,
  text: string,
  width: number,
  lineCount: number,
  sampleLine: string
): LayoutProjection => ({
  id,
  label,
  width,
  lineCount,
  sampleLine,
  characters: text.length
})

const baselineLayouts = Effect.forEach(
  corpus,
  (entry) =>
    Effect.forEach(
      widths,
      (width) =>
        Text.prepare(textInput(entry.text)).pipe(Effect.map((prepared) => {
          const summary = Text.layout(prepared, {
            maxWidth: width,
            lineHeight: 20
          })
          const lines = Text.layoutLines(prepared, {
            maxWidth: width,
            lineHeight: 20
          })
          const firstLine = Option.fromNullable(lines.at(0))

          return projectLayout(
            entry.id,
            entry.label,
            entry.text,
            width,
            summary.lineCount,
            Option.match(firstLine, {
              onNone: () => "",
              onSome: (line) => line.text
            })
          )
        })),
      { concurrency: 1 }
    ),
  { concurrency: 1 }
).pipe(
  Effect.map((entries) => entries.flatMap((entry) => entry)),
  Effect.provide(Text.TextLayoutLive)
)

const optimizedLayouts = Effect.forEach(
  corpus,
  (entry) =>
    Text.prepare(textInput(entry.text)).pipe(
      Effect.flatMap((prepared) =>
        Effect.forEach(
          widths,
          (width) =>
            Effect.sync(() => {
              const summary = Text.layout(prepared, {
                maxWidth: width,
                lineHeight: 20
              })
              const lines = Text.layoutLines(prepared, {
                maxWidth: width,
                lineHeight: 20
              })
              const firstLine = Option.fromNullable(lines.at(0))

              return projectLayout(
                entry.id,
                entry.label,
                entry.text,
                width,
                summary.lineCount,
                Option.match(firstLine, {
                  onNone: () => "",
                  onSome: (line) => line.text
                })
              )
            }),
          { concurrency: 1 }
        )
      )
    ),
  { concurrency: 1 }
).pipe(
  Effect.map((entries) => entries.flatMap((entry) => entry)),
  Effect.provide(Text.TextLayoutLive)
)

const measured = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const value = yield* effect
    const endedAt = yield* Clock.currentTimeMillis

    return {
      value,
      durationMs: endedAt - startedAt
    }
  })

const performanceSection = ({
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

const obstacleSection = ({
  lineCount,
  obstacleCount
}: {
  readonly lineCount: number
  readonly obstacleCount: number
}): EvidenceSection => ({
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

const corpusSection = (sampleLabel: string): EvidenceSection => ({
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

const corpusMatrixSection = (projectedMatrix: ReadonlyArray<CorpusMatrixEntry>): EvidenceSection => ({
  title: "Corpus Matrix",
  items: [
    {
      _tag: "Table",
      label: "Corpus projections",
      columns: [
        "Entry",
        "Characters",
        ...Arr.map(widths, (w) => `${w}px measured`),
        ...Arr.map(widths, (w) => `${w}px naive`)
      ],
      rows: Arr.map(projectedMatrix, (entry) => {
        const measuredCols = Arr.map(entry.projections, (projection) => String(projection.measuredLineCount))
        const naiveCols = Arr.map(entry.projections, (projection) => String(projection.naiveLineCount))
        return [entry.label, String(entry.characters), ...measuredCols, ...naiveCols]
      })
    }
  ]
})

const widthMetricsSection = (widthMetricSnapshot: ReadonlyArray<WidthMetric>): EvidenceSection => ({
  title: "Width Metrics",
  items: Arr.map(widthMetricSnapshot, (m): EvidenceItem => ({
    _tag: "Text",
    label: `Width ${m.width}`,
    value: `${m.meanMeasuredLineCount.toFixed(2)} measured / ${m.meanNaiveLineCount.toFixed(2)} naive (MAE ${
      m.meanAbsoluteLineError.toFixed(4)
    })`
  }))
})

const obstacleProjection = Effect.gen(function*() {
  const sampleEntry = corpus[0]!
  const prepared = yield* Text.prepare(textInput(sampleEntry.text))
  const summary = Text.layout(prepared, { maxWidth: focusWidth, lineHeight: 20 })

  return {
    lineCount: summary.lineCount,
    obstacleCount: obstacleDefinitions.length
  }
}).pipe(Effect.provide(Text.TextLayoutLive))

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const baseline = yield* measured(baselineLayouts)
  const optimized = yield* measured(optimizedLayouts)
  const obstacles = yield* obstacleProjection
  const endedAt = yield* Clock.currentTimeMillis

  const naiveLineErrorMean = meanNaiveError(optimized.value)
  const projectedCorpus = corpusProjection(optimized.value, corpus, focusWidth)
  const projectedMatrix = corpusMatrixProjection(optimized.value, corpus, widths)
  const widthMetricSnapshot = widthMetrics(optimized.value, widths)
  const runnableProgram = yield* preloadProgram

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

const customCorpusEntry = (customText: string): CorpusEntry => ({
  id: "custom",
  label: "Your text",
  text: customText
})

const customTextSection = (customText: string): Effect.Effect<EvidenceSection, unknown, never> =>
  Effect.gen(function*() {
    const entry = customCorpusEntry(customText)
    const prepared = yield* Text.prepare(textInput(entry.text))

    const rows = Arr.map(widths, (width) => {
      const summary = Text.layout(prepared, { maxWidth: width, lineHeight: 20 })
      const lines = Text.layoutLines(prepared, { maxWidth: width, lineHeight: 20 })
      const firstLine = Option.fromNullable(lines.at(0))

      return [
        entry.label,
        String(entry.text.length),
        String(width),
        String(summary.lineCount),
        Option.match(firstLine, { onNone: () => "", onSome: (line) => line.text })
      ]
    })

    const items: ReadonlyArray<EvidenceItem> = [
      {
        _tag: "Scalar",
        label: "Characters",
        value: entry.text.length,
        unit: "chars",
        format: "integer"
      },
      {
        _tag: "Table",
        label: "Custom text projections",
        columns: ["Entry", "Characters", "Width", "Lines", "First Line"],
        rows
      }
    ]

    return {
      title: "Custom Text",
      items
    }
  }).pipe(Effect.provide(Text.TextLayoutLive))

export const streamSections = (customText?: string): Stream.Stream<EvidenceSection, unknown, never> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const getBaseline = yield* Effect.cached(measured(baselineLayouts))
      const getOptimized = yield* Effect.cached(measured(optimizedLayouts))
      const getObstacles = yield* Effect.cached(obstacleProjection)

      const customStream = Option.fromNullable(customText).pipe(
        Option.map((text) => text.trim()),
        Option.filter((text) => text.length > 0),
        Option.match({
          onSome: (text) => Stream.fromEffect(customTextSection(text)),
          onNone: () => Stream.empty
        })
      )

      return Stream.concat(
        Stream.make(corpusSection(corpus[0]?.label ?? "none")),
        Stream.concat(
          customStream,
          Stream.concat(
            Stream.fromEffect(
              getObstacles.pipe(
                Effect.map((obstacles) => obstacleSection(obstacles))
              )
            ),
            Stream.concat(
              Stream.fromEffect(
                Effect.gen(function*() {
                  const baseline = yield* getBaseline
                  const optimized = yield* getOptimized

                  return performanceSection({
                    baselineDurationMs: baseline.durationMs,
                    optimizedDurationMs: optimized.durationMs,
                    naiveLineErrorMean: meanNaiveError(optimized.value)
                  })
                })
              ),
              Stream.concat(
                Stream.fromEffect(
                  getOptimized.pipe(
                    Effect.map((optimized): EvidenceSection => {
                      const projectedMatrix = corpusMatrixProjection(optimized.value, corpus, widths)

                      return corpusMatrixSection(projectedMatrix)
                    })
                  )
                ),
                Stream.fromEffect(
                  getOptimized.pipe(
                    Effect.map((optimized) => widthMetricsSection(widthMetrics(optimized.value, widths)))
                  )
                )
              )
            )
          )
        )
      )
    })
  )
