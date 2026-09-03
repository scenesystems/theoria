/**
 * Applies latency and cost constraints to TPE, where values less than or equal
 * to zero mark feasible configurations.
 *
 * Run: bun run examples/15-constrained-optimization.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Either, Match, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

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
    objective: (config) =>
      Effect.succeed(
        Numeric.pow(config.x - 0.65, 2) + Numeric.pow(config.y - 0.25, 2)
      )
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
