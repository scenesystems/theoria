/**
 * Warm Start — seed optimization with historical trial results.
 *
 * Real use case: continue infrastructure tuning from last week's production runs.
 *
 * What this shows: seeding TPE with prior trials so optimization starts from historical signal.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/09-warm-start.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const latencyScore = (config: {
  readonly workerCount: number
  readonly batchSize: number
  readonly retryDelayMillis: number
  readonly strategy: "least-conn" | "round-robin" | "queue-depth"
}): number => {
  const workerTerm = 220 / config.workerCount
  const batchPenalty = Math.abs(config.batchSize - 160) * 0.4
  const retryPenalty = config.retryDelayMillis * 0.2
  const strategyPenalty = Match.value(config.strategy).pipe(
    Match.when("least-conn", () => 0),
    Match.when("queue-depth", () => 4),
    Match.orElse(() => 8)
  )
  return 40 + workerTerm + batchPenalty + retryPenalty + strategyPenalty
}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    workerCount: SearchSpace.int(4, 32, { step: 4 }),
    batchSize: SearchSpace.int(32, 256, { step: 32 }),
    retryDelayMillis: SearchSpace.int(20, 160, { step: 20 }),
    strategy: SearchSpace.categorical(["least-conn", "round-robin", "queue-depth"])
  })
  const makePriorTrial = (config: SearchSpace.Type<typeof space>, value: number) =>
    new Study.PriorTrial({ config, value })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 2026 }),
    trials: 50,
    priorWeight: 0.6,
    priorTrials: [
      makePriorTrial({ workerCount: 16, batchSize: 160, retryDelayMillis: 40, strategy: "least-conn" }, 67),
      makePriorTrial({ workerCount: 12, batchSize: 192, retryDelayMillis: 60, strategy: "queue-depth" }, 74),
      makePriorTrial({ workerCount: 20, batchSize: 128, retryDelayMillis: 40, strategy: "least-conn" }, 70)
    ],
    objective: (config) => Effect.succeed(latencyScore(config))
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Warm-start optimization complete", {
          completionReason,
          bestLatency: bestTrial.state.value,
          bestConfig: bestTrial.config,
          trialsEvaluated: trials.length
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
