/**
 * Minimizes a two-dimensional objective with TPE and logs the best completed
 * trial.
 *
 * Run: bun run examples/01-quick-start.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) =>
      Effect.succeed(
        Num.sum(
          Numeric.pow(Num.subtract(config.x, 2), 2),
          Numeric.pow(Num.sum(config.y, 1), 2)
        )
      ),
    trials: 50
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason, trials }) =>
      Effect.log("Optimization complete", {
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config,
        completionReason,
        trialsEvaluated: Iterable.size(trials)
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
