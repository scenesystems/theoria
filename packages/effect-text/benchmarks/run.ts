import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Chunk, Clock, Console, Effect, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { Text } from "../src/index.js"
import {
  BenchmarkReportSchema,
  benchmarkCorpus,
  benchmarkIterations,
  type BenchmarkCorpusCase,
  type BenchmarkCaseReportType,
  type BenchmarkMetricSampleType,
  type BenchmarkMetricType,
  type BenchmarkReportType
} from "./corpus.js"

const outputUrl = new URL("./results/materialize-baseline.json", import.meta.url)
const BenchmarkReportJsonSchema = Schema.parseJson(BenchmarkReportSchema)

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
  prepared: Text.PreparedText,
  request: BenchmarkCorpusCase["request"],
  cursor = Text.initialCursor()
): ReadonlyArray<Text.LayoutLineType> =>
  Option.match(Text.layoutNextLine(prepared, request, cursor), {
    onNone: () => [],
    onSome: ([line, nextCursor]) => [line, ...collectCursorLines(prepared, request, nextCursor)]
  })

const benchmarkCase = (corpusCase: BenchmarkCorpusCase): Effect.Effect<BenchmarkCaseReportType> =>
  Effect.gen(function*() {
    const prepared = yield* Text.prepare(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive))

    return {
      name: corpusCase.name,
      request: corpusCase.request,
      metrics: {
        prepare: yield* measureEffect(
          benchmarkIterations,
          () => Text.prepare(corpusCase.prepare).pipe(Effect.provide(Text.TextLayoutLive)),
          (preparedText) => ({ segmentCount: Text.PreparedText.core(preparedText).segments.length })
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
        walkLineRanges: { status: "missing-api" }
      }
    }
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const outputPath = yield* pathService.fromFileUrl(outputUrl).pipe(Effect.orDie)
  const outputDirectory = pathService.dirname(outputPath)
  const report: BenchmarkReportType = {
    benchmark: "effect-text-materialize-baseline",
    iterations: benchmarkIterations,
    corpus: yield* Effect.forEach(benchmarkCorpus, benchmarkCase)
  }
  const encoded = yield* Schema.encode(BenchmarkReportJsonSchema)(report)

  yield* fileSystem.makeDirectory(outputDirectory, { recursive: true }).pipe(Effect.orDie)
  yield* fileSystem.writeFileString(outputPath, `${encoded}\n`).pipe(Effect.orDie)
  yield* Console.log(`Wrote effect-text benchmark baseline: ${outputPath}`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
