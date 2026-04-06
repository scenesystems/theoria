import { Array as Arr } from "effect"

import type { BenchmarkArtifact } from "./schema.js"

const seedAggregationViolations = (
  timingKind: string,
  seedCount: number,
  sampleCount: number
): Array<string> => [
  ...(seedCount < 2 ? [`${timingKind} benchmark no longer aggregates multiple seeds`] : []),
  ...(sampleCount !== seedCount
    ? [`${timingKind} benchmark emitted ${sampleCount} samples for ${seedCount} configured seeds`]
    : [])
]

export const validateBenchmarkArtifact = (artifact: BenchmarkArtifact): Array<string> => [
  ...seedAggregationViolations("sampler", artifact.sampler.seedCount, artifact.sampler.samples.length),
  ...seedAggregationViolations("engine", artifact.engine.seedCount, artifact.engine.samples.length),
  ...seedAggregationViolations("objective", artifact.objective.seedCount, artifact.objective.samples.length),
  ...(artifact.sampler.longAverageMs > artifact.sampler.maxLongAverageMs
    ? [
      `sampler long-average ${artifact.sampler.longAverageMs.toFixed(2)}ms exceeded ${artifact.sampler.maxLongAverageMs.toFixed(2)}ms`
    ]
    : []),
  ...(artifact.sampler.growthFactor > artifact.sampler.maxGrowthFactor
    ? [
      `sampler growth factor ${artifact.sampler.growthFactor.toFixed(2)} exceeded ${artifact.sampler.maxGrowthFactor.toFixed(2)}`
    ]
    : []),
  ...(artifact.engine.longAskAverageMs > artifact.engine.maxLongAskAverageMs
    ? [
      `engine ask average ${artifact.engine.longAskAverageMs.toFixed(2)}ms exceeded ${artifact.engine.maxLongAskAverageMs.toFixed(2)}ms`
    ]
    : []),
  ...(artifact.engine.longTellAverageMs > artifact.engine.maxLongTellAverageMs
    ? [
      `engine tell average ${artifact.engine.longTellAverageMs.toFixed(2)}ms exceeded ${artifact.engine.maxLongTellAverageMs.toFixed(2)}ms`
    ]
    : []),
  ...(artifact.engine.askGrowthFactor > artifact.engine.maxAskGrowthFactor
    ? [
      `engine ask growth factor ${artifact.engine.askGrowthFactor.toFixed(2)} exceeded ${artifact.engine.maxAskGrowthFactor.toFixed(2)}`
    ]
    : []),
  ...(artifact.engine.tellGrowthFactor > artifact.engine.maxTellGrowthFactor
    ? [
      `engine tell growth factor ${artifact.engine.tellGrowthFactor.toFixed(2)} exceeded ${artifact.engine.maxTellGrowthFactor.toFixed(2)}`
    ]
    : []),
  ...(artifact.objective.wallClockMs > artifact.objective.maxWallClockMs
    ? [
      `objective wall clock ${artifact.objective.wallClockMs.toFixed(2)}ms exceeded ${artifact.objective.maxWallClockMs.toFixed(2)}ms`
    ]
    : []),
  ...(Arr.some(artifact.engine.samples, ({ samplerMetrics }) => samplerMetrics.pendingCount !== 0)
    ? ["engine benchmark left pending trials in a seeded sample"]
    : []),
  ...(Arr.some(artifact.objective.samples, ({ completedTrialCount }) => completedTrialCount !== artifact.objective.trials)
    ? ["objective benchmark ended before every seeded sample completed its trial budget"]
    : [])
]
