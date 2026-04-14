import { Schema } from "effect"

import {
  BenchmarkSuitePlanSchema,
  type BenchmarkSuitePlan,
  EngineBenchmarkPlanSchema,
  ObjectiveBenchmarkPlanSchema,
  SamplerBenchmarkPlanSchema
} from "./schema.js"

const IS_CI = Boolean(process.env.CI)
const benchmarkSeeds = IS_CI ? [2701, 2713] : [2701, 2713, 2729]
const objectiveBenchmarkSeeds = IS_CI ? [811, 823] : [811, 823, 827]

export const samplerBenchmarkPlan = Schema.decodeUnknownSync(SamplerBenchmarkPlanSchema)({
  caseId: "sampler-suggestion-growth",
  seeds: benchmarkSeeds,
  shortHistoryLength: 6,
  longHistoryLength: 18,
  runsPerSeed: IS_CI ? 1 : 2,
  maxLongAverageMs: IS_CI ? 10_000 : 5_000,
  maxGrowthFactor: IS_CI ? 6 : 5
})

export const engineBenchmarkPlan = Schema.decodeUnknownSync(EngineBenchmarkPlanSchema)({
  caseId: "ask-tell-hot-path",
  seeds: benchmarkSeeds,
  shortHistoryLength: 6,
  longHistoryLength: 24,
  measurementCycles: IS_CI ? 2 : 4,
  maxLongAskAverageMs: IS_CI ? 10_000 : 5_000,
  maxLongTellAverageMs: IS_CI ? 10_000 : 5_000,
  maxAskGrowthFactor: IS_CI ? 6 : 5,
  maxTellGrowthFactor: IS_CI ? 6 : 5
})

export const objectiveBenchmarkPlan = Schema.decodeUnknownSync(ObjectiveBenchmarkPlanSchema)({
  caseId: "tpe-history-growth",
  seeds: objectiveBenchmarkSeeds,
  trials: 100,
  maxWallClockMs: IS_CI ? 30_000 : 10_000
})

export const benchmarkSuitePlan: BenchmarkSuitePlan = Schema.decodeUnknownSync(BenchmarkSuitePlanSchema)({
  sampler: samplerBenchmarkPlan,
  engine: engineBenchmarkPlan,
  objective: objectiveBenchmarkPlan
})
