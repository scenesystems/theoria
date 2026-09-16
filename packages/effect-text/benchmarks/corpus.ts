import { Schema } from "effect"
import * as Arr from "effect/Array"

import { Text } from "@scenesystems/effect-text"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export const BenchmarkCorpusCase = Schema.Struct({
  name: Schema.String,
  prepare: Text.Input,
  request: Text.Request
})

export type BenchmarkCorpusCase = typeof BenchmarkCorpusCase.Type

export const BenchmarkCorpus = Schema.Array(BenchmarkCorpusCase)

export type BenchmarkCorpus = typeof BenchmarkCorpus.Type

export const BenchmarkSample = Schema.Struct({
  naturalWidth: Schema.optional(NonNegativeFiniteNumber),
  summary: Schema.optional(Text.Summary),
  lines: Schema.optional(Text.Lines),
  layout: Schema.optional(Text.Layout),
  ranges: Schema.optional(Text.LineRanges)
})

export type BenchmarkSample = typeof BenchmarkSample.Type

export const BenchmarkTiming = Schema.Struct({
  iterations: PositiveInt,
  totalDurationNanos: Schema.PositiveBigInt,
  meanDurationNanos: Schema.PositiveBigInt
})

export type BenchmarkTiming = typeof BenchmarkTiming.Type

export const BenchmarkMeasurement = Schema.Struct({
  ...BenchmarkTiming.fields,
  sample: BenchmarkSample
})

export type BenchmarkMeasurement = typeof BenchmarkMeasurement.Type

export const BenchmarkMetrics = Schema.Struct({
  prepareWithSegments: BenchmarkMeasurement,
  summary: BenchmarkMeasurement,
  lines: BenchmarkMeasurement,
  layout: BenchmarkMeasurement,
  nextLine: BenchmarkMeasurement,
  stream: BenchmarkMeasurement,
  ranges: BenchmarkMeasurement,
  naturalWidth: BenchmarkMeasurement
})

export type BenchmarkMetrics = typeof BenchmarkMetrics.Type

export const BenchmarkCaseReport = Schema.Struct({
  name: Schema.String,
  request: Text.Request,
  metrics: BenchmarkMetrics
})

export type BenchmarkCaseReport = typeof BenchmarkCaseReport.Type

export const BenchmarkReport = Schema.Struct({
  benchmark: Schema.Literal("effect-text-public-api"),
  runtime: Schema.String,
  iterations: PositiveInt,
  clock: Schema.Literal("Clock.currentTimeNanos"),
  cachePolicy: Schema.Literal("one-live-layer-warm-cache"),
  effectOverhead: BenchmarkTiming,
  corpus: Schema.Array(BenchmarkCaseReport)
})

export type BenchmarkReport = typeof BenchmarkReport.Type

export const BenchmarkReportJson = Schema.parseJson(BenchmarkReport, { space: 2 })

export type BenchmarkReportJson = typeof BenchmarkReportJson.Type

export const benchmarkIterations = 500

export const benchmarkCorpus = Schema.decodeUnknownSync(BenchmarkCorpus)(
  Arr.make({
    name: "short-prose",
    prepare: {
      text: "Effect keeps preparation effectful and the layout hot path pure.",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 160, lineHeight: 18 }
  }, {
    name: "hard-breaks",
    prepare: {
      text: "Line one\nLine two\nLine three",
      font: { family: "Mono", size: 12 },
      whiteSpace: "pre-wrap"
    },
    request: { maxWidth: 120, lineHeight: 18 }
  }, {
    name: "tabs",
    prepare: {
      text: "col1\tcol2\tcol3",
      font: { family: "Mono", size: 12 },
      whiteSpace: "pre-wrap"
    },
    request: { maxWidth: 140, lineHeight: 18 }
  }, {
    name: "bidi",
    prepare: {
      text: "שלום hello עולם world",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 120, lineHeight: 18 }
  }, {
    name: "cjk",
    prepare: {
      text: "東京の空は静かに青く澄んでいる",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 80, lineHeight: 18 }
  }, {
    name: "long-token-overflow",
    prepare: {
      text: "supercalifragilisticexpialidocious",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 50, lineHeight: 18 }
  })
)
