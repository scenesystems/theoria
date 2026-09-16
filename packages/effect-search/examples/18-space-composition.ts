/**
 * Builds task-specific spaces from shared parameter groups with `extend`,
 * `pick`, and `omit`, then optimizes one projected space.
 *
 * Run: bun run examples/18-space-composition.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const optimizerSpace = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    batchSize: SearchSpace.int(16, 128, { step: 16 }),
    dropout: SearchSpace.float(0, 0.5)
  })
  const runtimeSpace = yield* SearchSpace.make({
    maxTokens: SearchSpace.int(256, 2048, { step: 256 }),
    rerankDepth: SearchSpace.int(5, 30, { step: 5 })
  })

  const fullSpace = yield* SearchSpace.extend(optimizerSpace, runtimeSpace)
  const servingSpace = yield* SearchSpace.pick(fullSpace, Arr.make("learningRate", "batchSize", "maxTokens"))
  const noDropoutSpace = yield* SearchSpace.omit(fullSpace, Arr.of("dropout"))

  const result = yield* Optimization.maximize({
    space: servingSpace,
    sampler: Sampler.tpe({ seed: 78 }),
    trials: 35,
    objective: (config) => {
      const learningRateScore = Num.subtract(
        1,
        Numeric.abs(Num.subtract(Numeric.log10(config.learningRate), Numeric.log10(0.01)))
      )
      const batchScore = Num.subtract(
        1,
        Num.unsafeDivide(Numeric.abs(Num.subtract(config.batchSize, 64)), 64)
      )
      const tokenPenalty = Num.unsafeDivide(config.maxTokens, 4096)

      return Effect.succeed(Num.subtract(Num.sum(learningRateScore, batchScore), tokenPenalty))
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason }) =>
      Effect.log("Space composition complete", {
        completionReason,
        fullDimensions: Arr.map(fullSpace.params, (parameter) => parameter.name),
        servingDimensions: Arr.map(servingSpace.params, (parameter) => parameter.name),
        noDropoutDimensions: Arr.map(noDropoutSpace.params, (parameter) => parameter.name),
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
