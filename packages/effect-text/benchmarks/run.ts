import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Chunk, Clock, Console, Effect, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { Text } from "../src/index.js"
import { preparedTextCore } from "../src/Text/model.js"
import {
  BenchmarkComparisonReportSchema,
  BenchmarkReportSchema,
  benchmarkCorpus,
  benchmarkIterations,
  type BenchmarkComparisonCaseReportType,
  type BenchmarkComparisonMetricType,
  type BenchmarkComparisonReportType,
  type BenchmarkCorpusCase,
  type BenchmarkCaseReportType,
  type BenchmarkMetricSampleType,
  type BenchmarkMetricType,
  type BenchmarkReportType
} from "./corpus.js"

const baselineOutputUrl = new URL("./results/materialize-baseline.json", import.meta.url)
const walkerOutputUrl = new URL("./results/walker-kernel.json", import.meta.url)
const comparisonOutputUrl = new URL("./results/walker-vs-materialize.json", import.meta.url)
const BenchmarkReportJsonSchema = Schema.parseJson(BenchmarkReportSchema)
const BenchmarkComparisonReportJsonSchema = Schema.parseJson(BenchmarkComparisonReportSchema)

const meanDuration = (totalDurationMs: number, iterations: number): number => totalDurationMs / iterations

const measureEffect = <A>(
  iterations: number,
  run: () => Effect.Effect<A>,
  summarize: (value: A) => BenchmarkMetricSampleType
): Effect.Effect<BenchmarkMetricType> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis

    yield* Effect.forEach(Arr.range(1, iterations), () => run(), { discard: true })

    const finishedAt = yield* Clock.currentTimeMillis
    const sample = yield* run()
    const totalDurationMs = finishedAt - startedAt

    return {
      status: "recorded",
      iterations,
      totalDurationMs,
      meanDurationMs: meanDuration(totalDurationMs, iterations),
      sample: summarize(sample)
    }
  })

const measurePure = <A>(
  iterations: number,
  run: () => A,
  summarize: (value: A) => BenchmarkMetricSampleType
): Effect.Effect<BenchmarkMetricType> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis

    yield* Effect.forEach(Arr.range(1, iterations), () => Effect.sync(run), { discard: true })

    const finishedAt = yield* Clock.currentTimeMillis
    const sample = yield* Effect.sync(run)
    const totalDurationMs = finishedAt - startedAt

    return {
      status: "recorded",
      iterations,
      totalDurationMs,
      meanDurationMs: meanDuration(totalDurationMs, iterations),
      sample: summarize(sample)
    }
  })

const collectCursorLines = (
  prepared: Text.PreparedTextWithSegments,
  request: BenchmarkCorpusCase["request"],
  cursor = Text.initialCursor()
): ReadonlyArray<Text.LayoutLineType> =>
  Option.match(Text.layoutNextLine(prepared, request, cursor), {
    onNone: () => [],
    onSome: ([line, nextCursor]) => [line, ...collectCursorLines(prepared, request, nextCursor)]
  })

const benchmarkCase = (corpusCase: BenchmarkCorpusCase): Effect.Effect<BenchmarkCaseReportType> =>
  Effect.gen(function*() {
    const prepared = yield* Text.prepareWithSegments(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive))

    return {
      name: corpusCase.name,
      request: corpusCase.request,
      metrics: {
        prepare: yield* measureEffect(
          benchmarkIterations,
          () => Text.prepareWithSegments(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive)),
          (preparedText) => ({ segmentCount: preparedTextCore(preparedText).manualSurface.segments.length })
        ),
        layout: yield* measurePure(
          benchmarkIterations,
          () => Text.layout(prepared, corpusCase.request),
          (summary) => ({ lineCount: summary.lineCount, maxLineWidth: summary.maxLineWidth })
        ),
        layoutLines: yield* measurePure(
          benchmarkIterations,
          () => Text.layoutLines(prepared, corpusCase.request),
          (lines) => ({ lineCount: lines.length })
        ),
        layoutNextLine: yield* measurePure(
          benchmarkIterations,
          () => collectCursorLines(prepared, corpusCase.request),
          (lines) => ({ lineCount: lines.length })
        ),
        streamLines: yield* measureEffect(
          benchmarkIterations,
          () => Text.streamLines(prepared, corpusCase.request).pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          ),
          (lines) => ({ lineCount: lines.length })
        ),
        walkLineRanges: yield* measurePure(
          benchmarkIterations,
          () => Text.walkLineRanges(prepared, corpusCase.request),
          (ranges) => ({ lineCount: ranges.length })
        )
      }
    }
  })

const compareMetric = (
  baselineMetric: BenchmarkMetricType,
  walkerMetric: BenchmarkMetricType
): BenchmarkComparisonMetricType => {
  if (baselineMetric.status === "recorded" && walkerMetric.status === "recorded") {
    return {
      status: "compared",
      baselineMeanDurationMs: baselineMetric.meanDurationMs,
      walkerMeanDurationMs: walkerMetric.meanDurationMs,
      deltaMeanDurationMs: walkerMetric.meanDurationMs - baselineMetric.meanDurationMs,
      baselineTotalDurationMs: baselineMetric.totalDurationMs,
      walkerTotalDurationMs: walkerMetric.totalDurationMs
    }
  }

  if (baselineMetric.status === "missing-api" && walkerMetric.status === "recorded") {
    return {
      status: "new-surface",
      baselineStatus: baselineMetric.status,
      walkerMeanDurationMs: walkerMetric.meanDurationMs,
      walkerTotalDurationMs: walkerMetric.totalDurationMs,
      sample: walkerMetric.sample
    }
  }

  return {
    status: "unavailable",
    baselineStatus: baselineMetric.status,
    walkerStatus: walkerMetric.status
  }
}

const compareCaseReports = (
  baselineCase: BenchmarkCaseReportType,
  walkerCase: BenchmarkCaseReportType
): BenchmarkComparisonCaseReportType => ({
  name: walkerCase.name,
  request: walkerCase.request,
  metrics: {
    prepare: compareMetric(baselineCase.metrics.prepare, walkerCase.metrics.prepare),
    layout: compareMetric(baselineCase.metrics.layout, walkerCase.metrics.layout),
    layoutLines: compareMetric(baselineCase.metrics.layoutLines, walkerCase.metrics.layoutLines),
    layoutNextLine: compareMetric(baselineCase.metrics.layoutNextLine, walkerCase.metrics.layoutNextLine),
    streamLines: compareMetric(baselineCase.metrics.streamLines, walkerCase.metrics.streamLines),
    walkLineRanges: compareMetric(baselineCase.metrics.walkLineRanges, walkerCase.metrics.walkLineRanges)
  }
})

const findBaselineCase = (
  baselineReport: BenchmarkReportType,
  walkerCase: BenchmarkCaseReportType
): Effect.Effect<BenchmarkCaseReportType> =>
  Option.match(Arr.findFirst(baselineReport.corpus, (baselineCase) => baselineCase.name === walkerCase.name), {
    onNone: () => Effect.dieMessage(`Missing materialize baseline for benchmark case: ${walkerCase.name}`),
    onSome: Effect.succeed
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const baselinePath = yield* pathService.fromFileUrl(baselineOutputUrl).pipe(Effect.orDie)
  const walkerPath = yield* pathService.fromFileUrl(walkerOutputUrl).pipe(Effect.orDie)
  const comparisonPath = yield* pathService.fromFileUrl(comparisonOutputUrl).pipe(Effect.orDie)
  const outputDirectory = pathService.dirname(walkerPath)
  const walkerReport: BenchmarkReportType = {
    benchmark: "effect-text-walker-kernel",
    iterations: benchmarkIterations,
    corpus: yield* Effect.forEach(benchmarkCorpus, benchmarkCase)
  }
  const baselineText = yield* fileSystem.readFileString(baselinePath).pipe(Effect.orDie)
  const baselineReport = yield* Schema.decode(BenchmarkReportJsonSchema)(baselineText).pipe(Effect.orDie)
  const comparisonReport: BenchmarkComparisonReportType = {
    baselineBenchmark: "effect-text-materialize-baseline",
    walkerBenchmark: "effect-text-walker-kernel",
    iterations: benchmarkIterations,
    corpus: yield* Effect.forEach(walkerReport.corpus, (walkerCase) =>
      findBaselineCase(baselineReport, walkerCase).pipe(
        Effect.map((baselineCase) => compareCaseReports(baselineCase, walkerCase))
      )
    )
  }
  const encodedWalkerReport = yield* Schema.encode(BenchmarkReportJsonSchema)(walkerReport)
  const encodedComparisonReport = yield* Schema.encode(BenchmarkComparisonReportJsonSchema)(comparisonReport)

  yield* fileSystem.makeDirectory(outputDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(walkerPath, `${encodedWalkerReport}\n`).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(comparisonPath, `${encodedComparisonReport}\n`).pipe(Effect.orDie)
  yield* Console.log(`Wrote effect-text walker benchmark: ${walkerPath}`)
  yield* Console.log(`Wrote effect-text walker comparison: ${comparisonPath}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
