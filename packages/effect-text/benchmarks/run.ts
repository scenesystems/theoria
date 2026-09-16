import { Command, FileSystem, Path, Url } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { BigInt, Clock, Console, Duration, Effect, Layer, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Text, type TextMeasurer } from "@scenesystems/effect-text"
import {
  type BenchmarkCaseReport,
  benchmarkCorpus,
  type BenchmarkCorpusCase,
  benchmarkIterations,
  type BenchmarkMeasurement,
  type BenchmarkReport,
  BenchmarkReportJson,
  type BenchmarkSample,
  type BenchmarkTiming
} from "./corpus.js"

const reportPath = Effect.gen(function*() {
  const path = yield* Path.Path
  const url = yield* Url.fromString("../../../.tmp/effect-text-benchmark.json", import.meta.url)
  return yield* path.fromFileUrl(url)
})

// Every operation uses this same Effect batch, so its scheduling and callback
// costs are part of the measurement. The separately reported empty-Effect
// timing makes that measured overhead visible; operation timings are not
// adjusted because subtraction would amplify timer and runtime noise.
const measureTiming = <A, E, R>(run: () => Effect.Effect<A, E, R>): Effect.Effect<BenchmarkTiming, E, R> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeNanos
    yield* Effect.replicateEffect(run(), benchmarkIterations, { concurrency: 1, discard: true })
    const finishedAt = yield* Clock.currentTimeNanos
    const totalDuration = Duration.nanos(BigInt.subtract(finishedAt, startedAt))
    const meanDuration = Duration.unsafeDivide(totalDuration, benchmarkIterations)

    return {
      iterations: benchmarkIterations,
      totalDurationNanos: Duration.unsafeToNanos(totalDuration),
      meanDurationNanos: Duration.unsafeToNanos(meanDuration)
    }
  })

const measure = <A, E, R>(
  run: () => Effect.Effect<A, E, R>,
  summarize: (value: A) => BenchmarkSample
): Effect.Effect<BenchmarkMeasurement, E, R> =>
  Effect.gen(function*() {
    const sample = summarize(yield* run())
    const timing = yield* measureTiming(run)
    return { ...timing, sample }
  })

const measurePure = <A>(run: () => A, summarize: (value: A) => BenchmarkSample) =>
  measure(() => Effect.sync(run), summarize)

const collectCursorLines = (
  prepared: Text.WithSegments,
  request: BenchmarkCorpusCase["request"],
  cursor = Text.start
): Text.Lines => Arr.unfold(cursor, (currentCursor) => Text.nextLine(prepared, request, currentCursor))

const benchmarkCase = (
  corpusCase: BenchmarkCorpusCase
): Effect.Effect<BenchmarkCaseReport, TextMeasurer.Failed, Text.Services> =>
  Effect.gen(function*() {
    // This untimed call both supplies the shared prepared value and warms the
    // layer-owned measurement cache. Timed preparation then intentionally
    // measures warm-cache calls against the one Text.layer acquired by program.
    const prepared = yield* Text.prepareWithSegments(corpusCase.prepare)

    return {
      name: corpusCase.name,
      request: corpusCase.request,
      metrics: {
        prepareWithSegments: yield* measure(
          () => Text.prepareWithSegments(corpusCase.prepare),
          (value) => ({ naturalWidth: Text.naturalWidth(value) })
        ),
        summary: yield* measurePure(
          () => Text.summary(prepared, corpusCase.request),
          (summary) => ({ summary })
        ),
        lines: yield* measurePure(
          () => Text.lines(prepared, corpusCase.request),
          (lines) => ({ lines })
        ),
        layout: yield* measurePure(
          () => Text.layout(prepared, corpusCase.request),
          (layout) => ({ layout })
        ),
        nextLine: yield* measurePure(
          () => collectCursorLines(prepared, corpusCase.request),
          (lines) => ({ lines })
        ),
        stream: yield* measure(
          () =>
            Text.stream(prepared, corpusCase.request).pipe(
              Stream.runCollect,
              Effect.map(Arr.fromIterable)
            ),
          (lines) => ({ lines })
        ),
        ranges: yield* measurePure(
          () => Text.ranges(prepared, corpusCase.request),
          (ranges) => ({ ranges })
        ),
        naturalWidth: yield* measurePure(
          () => Text.naturalWidth(prepared),
          (naturalWidth) => ({ naturalWidth })
        )
      }
    }
  })

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const outputPath = yield* reportPath
  const report: BenchmarkReport = {
    benchmark: "effect-text-public-api",
    runtime: Str.concat("Bun ", Str.trim(yield* Command.string(Command.make("bun", "--version")))),
    iterations: benchmarkIterations,
    clock: "Clock.currentTimeNanos",
    cachePolicy: "one-live-layer-warm-cache",
    effectOverhead: yield* measureTiming(() => Effect.void),
    corpus: yield* Effect.forEach(benchmarkCorpus, benchmarkCase, { concurrency: 1 })
  }
  const encoded = yield* Schema.encode(BenchmarkReportJson)(report)

  yield* fileSystem.makeDirectory(path.dirname(outputPath), { recursive: true })
  yield* fileSystem.writeFileString(outputPath, Str.concat(encoded, "\n"))
  yield* Console.log(encoded)
  yield* Console.log(Str.concat("Wrote effect-text public API benchmark: ", outputPath))
})

// Text.layer is provided around the whole program so all corpus cases share one
// live service graph and cache rather than rebuilding services per iteration.
BunRuntime.runMain(program.pipe(Effect.provide(Layer.merge(Text.layer, BunContext.layer))))
