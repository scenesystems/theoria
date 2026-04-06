import { Schema } from "effect"

import { SamplerMetricsSchema } from "../src/Study/snapshot/metrics.js"

const BenchmarkSeedsSchema = Schema.NonEmptyArray(Schema.Number)

export const SamplerBenchmarkSampleSchema = Schema.Struct({
  seed: Schema.Number,
  shortAverageMs: Schema.Number,
  longAverageMs: Schema.Number,
  growthFactor: Schema.Number
})

export type SamplerBenchmarkSample = Schema.Schema.Type<typeof SamplerBenchmarkSampleSchema>

export const SamplerBenchmarkPlanSchema = Schema.Struct({
  caseId: Schema.Literal("sampler-suggestion-growth"),
  seeds: BenchmarkSeedsSchema,
  shortHistoryLength: Schema.Number,
  longHistoryLength: Schema.Number,
  runsPerSeed: Schema.Number,
  maxLongAverageMs: Schema.Number,
  maxGrowthFactor: Schema.Number
})

export type SamplerBenchmarkPlan = Schema.Schema.Type<typeof SamplerBenchmarkPlanSchema>

export const EngineBenchmarkSampleSchema = Schema.Struct({
  seed: Schema.Number,
  shortAskAverageMs: Schema.Number,
  longAskAverageMs: Schema.Number,
  shortTellAverageMs: Schema.Number,
  longTellAverageMs: Schema.Number,
  askGrowthFactor: Schema.Number,
  tellGrowthFactor: Schema.Number,
  samplerMetrics: SamplerMetricsSchema
})

export type EngineBenchmarkSample = Schema.Schema.Type<typeof EngineBenchmarkSampleSchema>

export const EngineBenchmarkPlanSchema = Schema.Struct({
  caseId: Schema.Literal("ask-tell-hot-path"),
  seeds: BenchmarkSeedsSchema,
  shortHistoryLength: Schema.Number,
  longHistoryLength: Schema.Number,
  measurementCycles: Schema.Number,
  maxLongAskAverageMs: Schema.Number,
  maxLongTellAverageMs: Schema.Number,
  maxAskGrowthFactor: Schema.Number,
  maxTellGrowthFactor: Schema.Number
})

export type EngineBenchmarkPlan = Schema.Schema.Type<typeof EngineBenchmarkPlanSchema>

export const ObjectiveBenchmarkSampleSchema = Schema.Struct({
  seed: Schema.Number,
  wallClockMs: Schema.Number,
  completedTrialCount: Schema.Number,
  samplerMetrics: SamplerMetricsSchema
})

export type ObjectiveBenchmarkSample = Schema.Schema.Type<typeof ObjectiveBenchmarkSampleSchema>

export const ObjectiveBenchmarkPlanSchema = Schema.Struct({
  caseId: Schema.Literal("tpe-history-growth"),
  seeds: BenchmarkSeedsSchema,
  trials: Schema.Number,
  maxWallClockMs: Schema.Number
})

export type ObjectiveBenchmarkPlan = Schema.Schema.Type<typeof ObjectiveBenchmarkPlanSchema>

export const BenchmarkSuitePlanSchema = Schema.Struct({
  sampler: SamplerBenchmarkPlanSchema,
  engine: EngineBenchmarkPlanSchema,
  objective: ObjectiveBenchmarkPlanSchema
})

export type BenchmarkSuitePlan = Schema.Schema.Type<typeof BenchmarkSuitePlanSchema>

export const SamplerBenchmarkResultSchema = Schema.Struct({
  timingKind: Schema.Literal("sampler"),
  caseId: Schema.Literal("sampler-suggestion-growth"),
  seeds: BenchmarkSeedsSchema,
  seedCount: Schema.Number,
  shortHistoryLength: Schema.Number,
  longHistoryLength: Schema.Number,
  runsPerSeed: Schema.Number,
  shortAverageMs: Schema.Number,
  longAverageMs: Schema.Number,
  growthFactor: Schema.Number,
  worstLongAverageMs: Schema.Number,
  worstGrowthFactor: Schema.Number,
  maxLongAverageMs: Schema.Number,
  maxGrowthFactor: Schema.Number,
  samples: Schema.NonEmptyArray(SamplerBenchmarkSampleSchema)
})

export type SamplerBenchmarkResult = Schema.Schema.Type<typeof SamplerBenchmarkResultSchema>

export const EngineBenchmarkResultSchema = Schema.Struct({
  timingKind: Schema.Literal("engine"),
  caseId: Schema.Literal("ask-tell-hot-path"),
  seeds: BenchmarkSeedsSchema,
  seedCount: Schema.Number,
  shortHistoryLength: Schema.Number,
  longHistoryLength: Schema.Number,
  measurementCycles: Schema.Number,
  shortAskAverageMs: Schema.Number,
  longAskAverageMs: Schema.Number,
  shortTellAverageMs: Schema.Number,
  longTellAverageMs: Schema.Number,
  askGrowthFactor: Schema.Number,
  tellGrowthFactor: Schema.Number,
  worstLongAskAverageMs: Schema.Number,
  worstLongTellAverageMs: Schema.Number,
  worstAskGrowthFactor: Schema.Number,
  worstTellGrowthFactor: Schema.Number,
  maxLongAskAverageMs: Schema.Number,
  maxLongTellAverageMs: Schema.Number,
  maxAskGrowthFactor: Schema.Number,
  maxTellGrowthFactor: Schema.Number,
  samplerMetrics: SamplerMetricsSchema,
  samples: Schema.NonEmptyArray(EngineBenchmarkSampleSchema)
})

export type EngineBenchmarkResult = Schema.Schema.Type<typeof EngineBenchmarkResultSchema>

export const ObjectiveBenchmarkResultSchema = Schema.Struct({
  timingKind: Schema.Literal("objective"),
  caseId: Schema.Literal("tpe-history-growth"),
  seeds: BenchmarkSeedsSchema,
  seedCount: Schema.Number,
  trials: Schema.Number,
  wallClockMs: Schema.Number,
  worstWallClockMs: Schema.Number,
  maxWallClockMs: Schema.Number,
  completedTrialCount: Schema.Number,
  samplerMetrics: SamplerMetricsSchema,
  samples: Schema.NonEmptyArray(ObjectiveBenchmarkSampleSchema)
})

export type ObjectiveBenchmarkResult = Schema.Schema.Type<typeof ObjectiveBenchmarkResultSchema>

export const BenchmarkArtifactSchema = Schema.Struct({
  suite: Schema.Literal("effect-search/benchmark"),
  suiteVersion: Schema.Literal(2),
  aggregationKind: Schema.Literal("mean-of-seeds"),
  generatedAtMillis: Schema.Number,
  sampler: SamplerBenchmarkResultSchema,
  engine: EngineBenchmarkResultSchema,
  objective: ObjectiveBenchmarkResultSchema
})

export type BenchmarkArtifact = Schema.Schema.Type<typeof BenchmarkArtifactSchema>

export const BenchmarkArtifactJsonSchema = Schema.parseJson(BenchmarkArtifactSchema)
