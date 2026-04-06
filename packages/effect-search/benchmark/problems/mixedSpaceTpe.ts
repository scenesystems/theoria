import { Effect, Schema } from "effect"
import { abs } from "effect-math/Numeric"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"

/**
 * Canonical mixed-space benchmark problem for the package-owned performance lane.
 */
export const mixedSpaceBenchmarkSpace = SearchSpace.unsafeMake({
  x: SearchSpace.float(-2, 2),
  depth: SearchSpace.int(1, 5),
  optimizer: SearchSpace.categorical(["adam", "sgd"])
})

/**
 * Typed benchmark configuration for the mixed-space TPE benchmark problem.
 */
export type MixedSpaceBenchmarkConfig = SearchSpace.Type<typeof mixedSpaceBenchmarkSpace>

/**
 * Decodes the canonical mixed-space benchmark configuration.
 */
export const decodeMixedSpaceBenchmarkConfig = Schema.decodeUnknownSync(mixedSpaceBenchmarkSpace.schema)

/**
 * Deterministic objective used by the benchmark harness.
 */
export const mixedSpaceBenchmarkObjective = (raw: unknown) => {
  const config = decodeMixedSpaceBenchmarkConfig(raw)

  return Effect.succeed(
    abs(config.x) + config.depth + (config.optimizer === "adam" ? 0 : 0.25)
  )
}

/**
 * Synthetic completed-trial seed used to build long-history runtime harnesses.
 */
export const syntheticMixedSpaceConfig = (trialNumber: number): MixedSpaceBenchmarkConfig => ({
  x: ((trialNumber % 17) / 4) - 2,
  depth: (trialNumber % 5) + 1,
  optimizer: trialNumber % 2 === 0 ? "adam" : "sgd"
})

/**
 * Canonical sampler configuration for the package-owned benchmark lane.
 */
export const mixedSpaceBenchmarkSampler = (seed: number) =>
  Sampler.tpe({
    seed,
    nStartupTrials: 4,
    nEiCandidates: 4
  })
