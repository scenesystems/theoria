/**
 * Minimizes a modeled CI duration and flake-risk score while each trial's
 * estimated infrastructure cost counts toward a fixed optimization budget.
 *
 * Run: bun run examples/applications/04-developer-ci-autotune.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Effect, Iterable, Match, Number as Num, Option, Record, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    workers: SearchSpace.int(1, 16),
    cacheMode: SearchSpace.categorical(Tuple.make("none", "partial", "full")),
    retries: SearchSpace.int(0, 3),
    shardCount: SearchSpace.int(1, 8),
    timeoutSeconds: SearchSpace.int(30, 180, { step: 15 })
  })
  const ciQualityScore = (config: SearchSpace.Type<typeof space>): number => {
    const cacheSpeed = Option.getOrElse(Record.get(CACHE_SPEED_FACTOR, config.cacheMode), () => 1)
    const cacheFlake = Option.getOrElse(Record.get(CACHE_FLAKE_FACTOR, config.cacheMode), () => 1)
    const baseDurationMinutes = Num.multiply(Num.unsafeDivide(34, Numeric.pow(config.workers, 0.64)), cacheSpeed)
    const shardImbalancePenalty = Num.unsafeDivide(
      Numeric.abs(Num.subtract(config.shardCount, Num.unsafeDivide(config.workers, 2.4))),
      9
    )
    const timeoutPenalty = Bool.match(Num.lessThan(config.timeoutSeconds, 60), {
      onFalse: () => 0,
      onTrue: () => Num.unsafeDivide(Num.subtract(60, config.timeoutSeconds), 34)
    })
    const flakeRisk = Num.sum(
      Num.multiply(Num.unsafeDivide(0.42, Num.sum(config.retries, 1.4)), cacheFlake),
      timeoutPenalty
    )

    return Num.sumAll(Arr.make(baseDurationMinutes, shardImbalancePenalty, Num.multiply(flakeRisk, 7.5)))
  }
  const ciInfraCost = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      Num.multiply(config.workers, 0.17),
      Num.multiply(config.shardCount, 0.11),
      Match.value(config.cacheMode).pipe(
        Match.when("full", () => 0.24),
        Match.when("partial", () => 0.12),
        Match.orElse(() => 0)
      )
    ))

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 2901 }),
    trials: 80,
    maxCost: 22,
    objective: (config) => {
      const objectiveValue = ciQualityScore(config)
      const infraCost = ciInfraCost(config)

      return Effect.succeed(new Optimization.ObjectiveReport({ value: objectiveValue, cost: infraCost }))
    }
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Developer CI autotuning complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          bestObjective: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
