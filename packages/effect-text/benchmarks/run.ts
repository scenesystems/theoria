import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Chunk, Clock, Console, Effect, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"

import { type Errors, Text } from "../src/index.js"
import {
  type BenchmarkCaseReportType,
  type BenchmarkComparisonCaseReportType,
  type BenchmarkComparisonMetricType,
  BenchmarkComparisonReportSchema,
  type BenchmarkComparisonReportType,
  benchmarkCorpus,
  type BenchmarkCorpusCase,
  benchmarkIterations,
  type BenchmarkMetricSampleType,
  type BenchmarkMetricType,
  BenchmarkReportSchema,
  type BenchmarkReportType,
  MissingBenchmarkBaselineError
} from "./corpus.js"

const resultPath = (fileName: string) =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const url = yield* Url.fromString(Str.concat("./results/", fileName), import.meta.url)
    return yield* pathService.fromFileUrl(url)
  })
const BenchmarkReportJsonSchema = Schema.parseJson(BenchmarkReportSchema)
const BenchmarkComparisonReportJsonSchema = Schema.parseJson(BenchmarkComparisonReportSchema)

const meanDuration = (totalDurationMs: number, iterations: number): number =>
  Num.unsafeDivide(totalDurationMs, iterations)

const measureEffect = <A, E>(
  iterations: number,
  run: () => Effect.Effect<A, E>,
  summarize: (value: A) => BenchmarkMetricSampleType
): Effect.Effect<BenchmarkMetricType, E> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis

    yield* Effect.forEach(Arr.range(1, iterations), () => run(), { discard: true })

    const finishedAt = yield* Clock.currentTimeMillis
    const sample = yield* run()
    const totalDurationMs = Num.subtract(finishedAt, startedAt)

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
    const totalDurationMs = Num.subtract(finishedAt, startedAt)

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
) => Arr.unfold(cursor, (currentCursor) => Text.layoutNextLine(prepared, request, currentCursor))

const benchmarkCase = (
  corpusCase: BenchmarkCorpusCase
): Effect.Effect<BenchmarkCaseReportType, Errors.MeasurementFailed> =>
  Effect.gen(function*() {
    const prepared = yield* Text.prepareWithSegments(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive))

    return {
      name: corpusCase.name,
      request: corpusCase.request,
      metrics: {
        prepare: yield* measureEffect(
          benchmarkIterations,
          () => Text.prepareWithSegments(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive)),
          (preparedText) => ({
            segmentCount: Arr.length(preparedText.logicalSurface.segments)
          })
        ),
        layout: yield* measurePure(
          benchmarkIterations,
          () => Text.layout(prepared, corpusCase.request),
          (summary) => ({ lineCount: summary.lineCount, maxLineWidth: summary.maxLineWidth })
        ),
        layoutLines: yield* measurePure(
          benchmarkIterations,
          () => Text.layoutLines(prepared, corpusCase.request),
          (lines) => ({ lineCount: Arr.length(lines) })
        ),
        layoutNextLine: yield* measurePure(
          benchmarkIterations,
          () => collectCursorLines(prepared, corpusCase.request),
          (lines) => ({ lineCount: Arr.length(lines) })
        ),
        streamLines: yield* measureEffect(
          benchmarkIterations,
          () =>
            Text.streamLines(prepared, corpusCase.request).pipe(
              Stream.runCollect,
              Effect.map(Chunk.toReadonlyArray)
            ),
          (lines) => ({ lineCount: Arr.length(lines) })
        ),
        walkLineRanges: yield* measurePure(
          benchmarkIterations,
          () => Text.walkLineRanges(prepared, corpusCase.request),
          (ranges) => ({ lineCount: Arr.length(ranges) })
        )
      }
    }
  })

const compareMetric = (
  baselineMetric: BenchmarkMetricType,
  walkerMetric: BenchmarkMetricType
): BenchmarkComparisonMetricType =>
  Match.value(baselineMetric).pipe(
    Match.when(
      { status: "recorded" },
      (baseline) =>
        Match.value(walkerMetric).pipe(
          Match.when(
            { status: "recorded" },
            (walker): BenchmarkComparisonMetricType => ({
              status: "compared",
              baselineMeanDurationMs: baseline.meanDurationMs,
              walkerMeanDurationMs: walker.meanDurationMs,
              deltaMeanDurationMs: Num.subtract(walker.meanDurationMs, baseline.meanDurationMs),
              baselineTotalDurationMs: baseline.totalDurationMs,
              walkerTotalDurationMs: walker.totalDurationMs
            })
          ),
          Match.when(
            { status: "missing-api" },
            (walker): BenchmarkComparisonMetricType => ({
              status: "unavailable",
              baselineStatus: baseline.status,
              walkerStatus: walker.status
            })
          ),
          Match.exhaustive
        )
    ),
    Match.when(
      { status: "missing-api" },
      (baseline) =>
        Match.value(walkerMetric).pipe(
          Match.when(
            { status: "recorded" },
            (walker): BenchmarkComparisonMetricType => ({
              status: "new-surface",
              baselineStatus: baseline.status,
              walkerMeanDurationMs: walker.meanDurationMs,
              walkerTotalDurationMs: walker.totalDurationMs,
              sample: walker.sample
            })
          ),
          Match.when(
            { status: "missing-api" },
            (walker): BenchmarkComparisonMetricType => ({
              status: "unavailable",
              baselineStatus: baseline.status,
              walkerStatus: walker.status
            })
          ),
          Match.exhaustive
        )
    ),
    Match.exhaustive
  )

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
): Effect.Effect<BenchmarkCaseReportType, MissingBenchmarkBaselineError> =>
  Arr.findFirst(baselineReport.corpus, (baselineCase) => Str.Equivalence(baselineCase.name, walkerCase.name)).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          new MissingBenchmarkBaselineError({
            caseName: walkerCase.name,
            message: Str.concat("Missing materialize baseline for benchmark case: ", walkerCase.name)
          })
        ),
      onSome: Effect.succeed
    })
  )

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const baselinePath = yield* resultPath("materialize-baseline.json")
  const walkerPath = yield* resultPath("walker-kernel.json")
  const comparisonPath = yield* resultPath("walker-vs-materialize.json")
  const outputDirectory = pathService.dirname(walkerPath)
  const walkerReport: BenchmarkReportType = {
    benchmark: "effect-text-walker-kernel",
    iterations: benchmarkIterations,
    corpus: yield* Effect.forEach(benchmarkCorpus, benchmarkCase)
  }
  const baselineText = yield* fileSystem.readFileString(baselinePath)
  const baselineReport = yield* Schema.decode(BenchmarkReportJsonSchema)(baselineText)
  const comparisonReport: BenchmarkComparisonReportType = {
    baselineBenchmark: "effect-text-materialize-baseline",
    walkerBenchmark: "effect-text-walker-kernel",
    iterations: benchmarkIterations,
    corpus: yield* Effect.forEach(
      walkerReport.corpus,
      (walkerCase) =>
        findBaselineCase(baselineReport, walkerCase).pipe(
          Effect.map((baselineCase) => compareCaseReports(baselineCase, walkerCase))
        )
    )
  }
  const encodedWalkerReport = yield* Schema.encode(BenchmarkReportJsonSchema)(walkerReport)
  const encodedComparisonReport = yield* Schema.encode(BenchmarkComparisonReportJsonSchema)(comparisonReport)

  yield* fileSystem.makeDirectory(outputDirectory, { recursive: true })
  yield* fileSystem.writeFileString(walkerPath, Str.concat(encodedWalkerReport, "\n"))
  yield* fileSystem.writeFileString(comparisonPath, Str.concat(encodedComparisonReport, "\n"))
  yield* Console.log(Str.concat("Wrote effect-text walker benchmark: ", walkerPath))
  yield* Console.log(Str.concat("Wrote effect-text walker comparison: ", comparisonPath))
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
