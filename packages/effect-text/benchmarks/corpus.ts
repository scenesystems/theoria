import { Schema } from "effect"

import { LayoutRequest, type LayoutRequestType, PrepareInput, type PrepareInputType } from "../src/Text/schema.js"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const BenchmarkReportNameSchema = Schema.Literal("effect-text-materialize-baseline", "effect-text-walker-kernel")
const BenchmarkMetricStatusSchema = Schema.Literal("recorded", "missing-api")

export type BenchmarkCorpusCase = {
  readonly name: string
  readonly prepare: PrepareInputType
  readonly request: LayoutRequestType
}

export const BenchmarkCorpusCaseSchema = Schema.Struct({
  name: Schema.String,
  prepare: PrepareInput,
  request: LayoutRequest
})

export const BenchmarkMetricSampleSchema = Schema.Struct({
  segmentCount: Schema.optional(NonNegativeInt),
  lineCount: Schema.optional(NonNegativeInt),
  maxLineWidth: Schema.optional(NonNegativeFiniteNumber)
})

export type BenchmarkMetricSampleType = typeof BenchmarkMetricSampleSchema.Type

export const RecordedBenchmarkMetricSchema = Schema.Struct({
  status: Schema.Literal("recorded"),
  iterations: PositiveInt,
  totalDurationMs: NonNegativeFiniteNumber,
  meanDurationMs: NonNegativeFiniteNumber,
  sample: BenchmarkMetricSampleSchema
})

export const MissingBenchmarkMetricSchema = Schema.Struct({
  status: Schema.Literal("missing-api")
})

export const BenchmarkMetricSchema = Schema.Union(RecordedBenchmarkMetricSchema, MissingBenchmarkMetricSchema)

export type BenchmarkMetricType = typeof BenchmarkMetricSchema.Type

export type BenchmarkMetricStatusType = typeof BenchmarkMetricStatusSchema.Type

export const BenchmarkCaseMetricsSchema = Schema.Struct({
  prepare: BenchmarkMetricSchema,
  layout: BenchmarkMetricSchema,
  layoutLines: BenchmarkMetricSchema,
  layoutNextLine: BenchmarkMetricSchema,
  streamLines: BenchmarkMetricSchema,
  walkLineRanges: BenchmarkMetricSchema
})

export const BenchmarkCaseReportSchema = Schema.Struct({
  name: Schema.String,
  request: LayoutRequest,
  metrics: BenchmarkCaseMetricsSchema
})

export type BenchmarkCaseReportType = typeof BenchmarkCaseReportSchema.Type

export const BenchmarkReportSchema = Schema.Struct({
  benchmark: BenchmarkReportNameSchema,
  iterations: PositiveInt,
  corpus: Schema.Array(BenchmarkCaseReportSchema)
})

export type BenchmarkReportType = typeof BenchmarkReportSchema.Type

export const ComparedBenchmarkMetricSchema = Schema.Struct({
  status: Schema.Literal("compared"),
  baselineMeanDurationMs: NonNegativeFiniteNumber,
  walkerMeanDurationMs: NonNegativeFiniteNumber,
  deltaMeanDurationMs: Schema.Number.pipe(Schema.finite()),
  baselineTotalDurationMs: NonNegativeFiniteNumber,
  walkerTotalDurationMs: NonNegativeFiniteNumber
})

export const NewSurfaceBenchmarkMetricSchema = Schema.Struct({
  status: Schema.Literal("new-surface"),
  baselineStatus: Schema.Literal("missing-api"),
  walkerMeanDurationMs: NonNegativeFiniteNumber,
  walkerTotalDurationMs: NonNegativeFiniteNumber,
  sample: BenchmarkMetricSampleSchema
})

export const UnavailableBenchmarkComparisonMetricSchema = Schema.Struct({
  status: Schema.Literal("unavailable"),
  baselineStatus: BenchmarkMetricStatusSchema,
  walkerStatus: BenchmarkMetricStatusSchema
})

export const BenchmarkComparisonMetricSchema = Schema.Union(
  ComparedBenchmarkMetricSchema,
  NewSurfaceBenchmarkMetricSchema,
  UnavailableBenchmarkComparisonMetricSchema
)

export type BenchmarkComparisonMetricType = typeof BenchmarkComparisonMetricSchema.Type

export const BenchmarkComparisonCaseMetricsSchema = Schema.Struct({
  prepare: BenchmarkComparisonMetricSchema,
  layout: BenchmarkComparisonMetricSchema,
  layoutLines: BenchmarkComparisonMetricSchema,
  layoutNextLine: BenchmarkComparisonMetricSchema,
  streamLines: BenchmarkComparisonMetricSchema,
  walkLineRanges: BenchmarkComparisonMetricSchema
})

export const BenchmarkComparisonCaseReportSchema = Schema.Struct({
  name: Schema.String,
  request: LayoutRequest,
  metrics: BenchmarkComparisonCaseMetricsSchema
})

export type BenchmarkComparisonCaseReportType = typeof BenchmarkComparisonCaseReportSchema.Type

export const BenchmarkComparisonReportSchema = Schema.Struct({
  baselineBenchmark: Schema.Literal("effect-text-materialize-baseline"),
  walkerBenchmark: Schema.Literal("effect-text-walker-kernel"),
  iterations: PositiveInt,
  corpus: Schema.Array(BenchmarkComparisonCaseReportSchema)
})

export type BenchmarkComparisonReportType = typeof BenchmarkComparisonReportSchema.Type

export const benchmarkIterations = 200

export const benchmarkCorpus: ReadonlyArray<BenchmarkCorpusCase> = [
  {
    name: "short-prose",
    prepare: {
      text: "Effect keeps preparation effectful and the layout hot path pure.",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 160, lineHeight: 18 }
  },
  {
    name: "hard-breaks",
    prepare: {
      text: "Line one\nLine two\nLine three",
      font: { family: "Mono", size: 12 },
      whiteSpace: "pre-wrap"
    },
    request: { maxWidth: 120, lineHeight: 18 }
  },
  {
    name: "tabs",
    prepare: {
      text: "col1\tcol2\tcol3",
      font: { family: "Mono", size: 12 },
      whiteSpace: "pre-wrap"
    },
    request: { maxWidth: 140, lineHeight: 18 }
  },
  {
    name: "bidi",
    prepare: {
      text: "שלום hello עולם world",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 120, lineHeight: 18 }
  },
  {
    name: "cjk",
    prepare: {
      text: "東京の空は静かに青く澄んでいる",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 80, lineHeight: 18 }
  },
  {
    name: "long-token-overflow",
    prepare: {
      text: "supercalifragilisticexpialidocious",
      font: { family: "Mono", size: 12 },
      whiteSpace: "normal"
    },
    request: { maxWidth: 50, lineHeight: 18 }
  }
]
