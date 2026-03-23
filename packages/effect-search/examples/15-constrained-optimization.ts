/**
 * Constrained Optimization — c-TPE suggestions under feasibility bounds.
 *
 * Real use case: tune a model where latency + cost must stay within limits.
 *
 * What this shows: adding feasibility constraints (<= 0) so TPE steers suggestions toward valid regions.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/15-constrained-optimization.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Either, Match, Schema } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(0, 1),
    y: SearchSpace.float(0, 1)
  })
  const decodeConstraintConfig = Schema.decodeUnknownEither(space.schema)

  const feasibilityConstraint = (rawConfig: unknown) =>
    Effect.sync(() =>
      decodeConstraintConfig(rawConfig).pipe(
        Either.match({
          onLeft: () => 1,
          onRight: (config) => config.x + config.y - 1
        })
      )
    )

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 404,
      nStartupTrials: 8,
      constraints: [feasibilityConstraint]
    }),
    trials: 60,
    objective: (config) => Effect.succeed((config.x - 0.65) ** 2 + (config.y - 0.25) ** 2)
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Constrained optimization complete", {
          completionReason,
          trialsEvaluated: trials.length,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config,
          bestConstraintValue: bestTrial.config.x + bestTrial.config.y - 1,
          feasible: bestTrial.config.x + bestTrial.config.y - 1 <= 0
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
