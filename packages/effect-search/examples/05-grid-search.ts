/**
 * Evaluates every point in a finite categorical, integer, and boolean search
 * space with the grid sampler.
 *
 * Run: bun run examples/05-grid-search.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Effect, Iterable, Match, Number as Num, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    optimizer: SearchSpace.categorical(Tuple.make("adam", "sgd", "adamw")),
    batchSize: SearchSpace.int(16, 64, { step: 16 }),
    useBatchNorm: SearchSpace.boolean()
  })
  const simulatedAccuracy = (config: SearchSpace.Type<typeof space>): number => {
    const optimizerScore = Match.value(config.optimizer).pipe(
      Match.when("adamw", () => 0.94),
      Match.when("adam", () => 0.92),
      Match.orElse(() => 0.85)
    )
    const batchPenalty = Num.multiply(Numeric.abs(Num.subtract(config.batchSize, 32)), 0.002)
    const normBonus = Bool.match(config.useBatchNorm, { onFalse: () => 0, onTrue: () => 0.03 })
    return Num.sum(Num.subtract(optimizerScore, batchPenalty), normBonus)
  }

  const result = yield* Optimization.maximize({
    space,
    sampler: Sampler.grid({ shuffle: true, seed: 7 }),
    objective: (config) => Effect.succeed(simulatedAccuracy(config)),
    trials: 100
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, trials }) => {
      const completed = Arr.filter(trials, (trial) =>
        Match.value(trial.state).pipe(
          Match.tag("Completed", () => true),
          Match.orElse(() => false)
        ))
      return Effect.log("Grid search results", {
        bestAccuracy: bestTrial.state.value,
        bestConfig: bestTrial.config,
        evaluated: Arr.length(completed),
        totalGridPoints: Iterable.size(trials)
      })
    }),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
