/**
 * Compares univariate and multivariate TPE on an objective whose parameters
 * have a correlated optimum.
 *
 * Run: bun run examples/22-multivariate-tpe.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    y: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 5)
  })

  const objective = (config: SearchSpace.Type<typeof space>) =>
    Effect.succeed(
      Num.sumAll(Arr.make(
        Numeric.pow(Num.subtract(Num.sum(config.x, config.y), 0.5), 2),
        Num.multiply(Numeric.pow(Num.subtract(Num.subtract(config.x, config.y), 0.1), 2), 0.2),
        Num.multiply(Numeric.pow(Num.unsafeDivide(Num.subtract(config.depth, 3), 3), 2), 0.1)
      ))
    )

  const univariate = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 222,
      nStartupTrials: 8
    }),
    trials: 45,
    objective
  })
  const multivariate = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 222,
      nStartupTrials: 8,
      multivariate: true
    }),
    trials: 45,
    objective
  })

  const bestValueFrom = (result: Optimization.Result<SearchSpace.Type<typeof space>>) =>
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
    delta: Num.subtract(univariateBest, multivariateBest)
  })
})

BunRuntime.runMain(program)
