/**
 * Grid Search — exhaustive search over a small discrete space.
 *
 * When the parameter space is small enough, grid search guarantees
 * every combination is evaluated. Useful for finite categorical
 * and stepped integer spaces.
 *
 * What this shows: exhaustive search over a finite space when you need guaranteed coverage of all combinations.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/05-grid-search.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const simulatedAccuracy = (config: {
  readonly optimizer: "adam" | "sgd" | "adamw"
  readonly batchSize: number
  readonly useBatchNorm: boolean
}): number => {
  const optimizerScore = Match.value(config.optimizer).pipe(
    Match.when("adamw", () => 0.94),
    Match.when("adam", () => 0.92),
    Match.orElse(() => 0.85)
  )
  const batchPenalty = Math.abs(config.batchSize - 32) * 0.002
  const normBonus = config.useBatchNorm ? 0.03 : 0
  return optimizerScore - batchPenalty + normBonus
}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
    batchSize: SearchSpace.int(16, 64, { step: 16 }),
    useBatchNorm: SearchSpace.boolean()
  })

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.grid({ shuffle: true, seed: 7 }),
    objective: (config) => Effect.succeed(simulatedAccuracy(config)),
    trials: 100
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, trials }) => {
      const completed = Arr.filter(trials, (trial) => trial.state._tag === "Completed")
      return Effect.log("Grid search results", {
        bestAccuracy: bestTrial.state.value,
        bestConfig: bestTrial.config,
        evaluated: completed.length,
        totalGridPoints: trials.length
      })
    }),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
