/**
 * Seeds TPE with measured infrastructure configurations before evaluating new
 * trials in the same optimization.
 *
 * Run: bun run examples/09-warm-start.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Number as Num, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    workerCount: SearchSpace.int(4, 32, { step: 4 }),
    batchSize: SearchSpace.int(32, 256, { step: 32 }),
    retryDelayMillis: SearchSpace.int(20, 160, { step: 20 }),
    strategy: SearchSpace.categorical(Tuple.make("least-conn", "round-robin", "queue-depth"))
  })
  const latencyScore = (config: SearchSpace.Type<typeof space>): number => {
    const workerTerm = Num.unsafeDivide(220, config.workerCount)
    const batchPenalty = Num.multiply(Numeric.abs(Num.subtract(config.batchSize, 160)), 0.4)
    const retryPenalty = Num.multiply(config.retryDelayMillis, 0.2)
    const strategyPenalty = Match.value(config.strategy).pipe(
      Match.when("least-conn", () => 0),
      Match.when("queue-depth", () => 4),
      Match.orElse(() => 8)
    )
    return Num.sumAll(Arr.make(40, workerTerm, batchPenalty, retryPenalty, strategyPenalty))
  }
  const makePriorTrial = (config: SearchSpace.Type<typeof space>, value: number) =>
    new Optimization.PriorTrial({ config, value })

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 2026 }),
    trials: 50,
    priorWeight: 0.6,
    priorTrials: Arr.make(
      makePriorTrial({ workerCount: 16, batchSize: 160, retryDelayMillis: 40, strategy: "least-conn" }, 67),
      makePriorTrial({ workerCount: 12, batchSize: 192, retryDelayMillis: 60, strategy: "queue-depth" }, 74),
      makePriorTrial({ workerCount: 20, batchSize: 128, retryDelayMillis: 40, strategy: "least-conn" }, 70)
    ),
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
          trialsEvaluated: Iterable.size(trials)
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
