/**
 * Early Stopping — terminate studies on convergence and policy controls.
 *
 * Real use case: stop expensive campaigns when additional trials add no value.
 *
 * What this shows: stopping studies via target value, no-improvement windows, or max duration.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/20-early-stopping.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1)
  })

  const result = yield* Study.minimize({
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
        trialsEvaluated: trials.length,
        bestValue: bestTrial.state.value
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
