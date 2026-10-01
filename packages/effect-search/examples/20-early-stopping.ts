/**
 * Runs an optimization that stops at a target value, after a no-improvement
 * window, or when the maximum duration expires.
 *
 * Run: bun run examples/20-early-stopping.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match } from "effect"

import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1)
  })

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.random({ seed: 707 }),
    trials: 200,
    concurrency: 1,
    targetValue: 0.05,
    noImprovementWindow: 4,
    maxDuration: "2 seconds",
    epsilon: 1e-6,
    objective: () => Effect.sleep("5 millis").pipe(Effect.as(0.8))
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason, trials }) =>
      Effect.log("Early stopping complete", {
        completionReason,
        trialsEvaluated: Iterable.size(trials),
        bestValue: bestTrial.state.value
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
