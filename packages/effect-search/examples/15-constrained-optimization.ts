/**
 * Applies latency and cost constraints to TPE, where values less than or equal
 * to zero mark feasible configurations.
 *
 * Run: bun run examples/15-constrained-optimization.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Either, Iterable, Match, Number as Num, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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
          onRight: (config) => Num.subtract(Num.sum(config.x, config.y), 1)
        })
      )
    )

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 404,
      nStartupTrials: 8,
      constraints: Arr.of(feasibilityConstraint)
    }),
    trials: 60,
    objective: (config) =>
      Effect.succeed(
        Num.sum(
          Numeric.pow(Num.subtract(config.x, 0.65), 2),
          Numeric.pow(Num.subtract(config.y, 0.25), 2)
        )
      )
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Constrained optimization complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config,
          bestConstraintValue: Num.subtract(Num.sum(bestTrial.config.x, bestTrial.config.y), 1),
          feasible: Num.lessThanOrEqualTo(Num.subtract(Num.sum(bestTrial.config.x, bestTrial.config.y), 1), 0)
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
