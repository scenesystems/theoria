/**
 * Advanced Applications / 04 — CI Configuration Tuning.
 *
 * Plain-English goal:
 * Speed up CI feedback while keeping compute spend under a fixed budget.
 *
 * Use case:
 * Choose worker count, caching mode, retries, sharding, and timeout settings
 * without hand-tuning dozens of combinations.
 *
 * Why `effect-search`:
 * `Study.ObjectiveReport` lets every trial report both quality and cost, so the
 * optimizer can stop once the budget is consumed.
 *
 * Objective semantics:
 * - `value` (lower is better): blended CI runtime and flake-risk proxy.
 * - `cost`: estimated infrastructure spend for that trial.
 *
 * What to expect in output:
 * The run typically ends with `budgetExhausted`, then logs the best configuration
 * found within your spending cap.
 *
 * How to use the result:
 * Treat the best config as a rollout candidate. Validate it with real CI
 * telemetry before adopting it globally.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Study.ObjectiveReport}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/applications/04-developer-ci-autotune.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const CACHE_SPEED_FACTOR: Readonly<Record<string, number>> = {
  none: 1.0,
  partial: 0.82,
  full: 0.7
}

const CACHE_FLAKE_FACTOR: Readonly<Record<string, number>> = {
  none: 1.0,
  partial: 0.88,
  full: 0.94
}

const ciQualityScore = (config: {
  readonly workers: number
  readonly cacheMode: "none" | "partial" | "full"
  readonly retries: number
  readonly shardCount: number
  readonly timeoutSeconds: number
}): number => {
  const cacheSpeed = CACHE_SPEED_FACTOR[config.cacheMode] ?? 1
  const cacheFlake = CACHE_FLAKE_FACTOR[config.cacheMode] ?? 1

  const baseDurationMinutes = (34 / Math.pow(config.workers, 0.64)) * cacheSpeed
  const shardImbalancePenalty = Math.abs(config.shardCount - config.workers / 2.4) / 9
  const timeoutPenalty = config.timeoutSeconds < 60 ? (60 - config.timeoutSeconds) / 34 : 0
  const flakeRisk = (0.42 / (config.retries + 1.4)) * cacheFlake + timeoutPenalty

  return baseDurationMinutes + shardImbalancePenalty + flakeRisk * 7.5
}

const ciInfraCost = (config: {
  readonly workers: number
  readonly cacheMode: "none" | "partial" | "full"
  readonly shardCount: number
}): number =>
  config.workers * 0.17
  + config.shardCount * 0.11
  + (config.cacheMode === "full" ? 0.24 : config.cacheMode === "partial" ? 0.12 : 0)

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    workers: SearchSpace.int(1, 16),
    cacheMode: SearchSpace.categorical(["none", "partial", "full"]),
    retries: SearchSpace.int(0, 3),
    shardCount: SearchSpace.int(1, 8),
    timeoutSeconds: SearchSpace.int(30, 180, { step: 15 })
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 2901 }),
    trials: 80,
    maxCost: 22,
    objective: (config) => {
      const objectiveValue = ciQualityScore(config)
      const infraCost = ciInfraCost(config)

      return Effect.succeed(new Study.ObjectiveReport({ value: objectiveValue, cost: infraCost }))
    }
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Developer CI autotuning complete", {
          completionReason,
          trialsEvaluated: trials.length,
          bestObjective: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
