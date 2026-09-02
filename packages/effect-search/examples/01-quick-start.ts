/**
 * Minimizes a two-dimensional objective with TPE and logs the best completed
 * trial.
 *
 * Run: bun run examples/01-quick-start.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) =>
      Effect.succeed(
        Numeric.pow(config.x - 2, 2) + Numeric.pow(config.y + 1, 2)
      ),
    trials: 50
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason, trials }) =>
      Effect.log("Optimization complete", {
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config,
        completionReason,
        trialsEvaluated: trials.length
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
