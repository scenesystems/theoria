/**
 * Multivariate TPE — model correlated dimensions jointly.
 *
 * Real use case: tune coupled hyperparameters where independent KDEs miss structure.
 *
 * What this shows: joint-density multivariate TPE for correlated parameters versus univariate TPE.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/22-multivariate-tpe.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    y: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 5)
  })

  const objective = (config: SearchSpace.Type<typeof space>) =>
    Effect.succeed(
      (config.x + config.y - 0.5) ** 2
        + ((config.x - config.y - 0.1) ** 2) * 0.2
        + ((config.depth - 3) / 3) ** 2 * 0.1
    )

  const univariate = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 222,
      nStartupTrials: 8
    }),
    trials: 45,
    objective
  })
  const multivariate = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 222,
      nStartupTrials: 8,
      multivariate: true
    }),
    trials: 45,
    objective
  })

  const bestValueFrom = (result: Study.StudyResult<SearchSpace.Type<typeof space>>) =>
    Match.value(result).pipe(
      Match.tag("SingleObjective", ({ bestTrial }) => bestTrial.state.value),
      Match.tag("MultiObjective", () => Number.POSITIVE_INFINITY),
      Match.exhaustive
    )

  const univariateBest = bestValueFrom(univariate)
  const multivariateBest = bestValueFrom(multivariate)

  yield* Effect.log("Multivariate comparison complete", {
    univariateBest,
    multivariateBest,
    delta: univariateBest - multivariateBest
  })
})

BunRuntime.runMain(program)
