/**
 * Tunes generation settings while each objective report contributes estimated
 * cost toward the optimization's fixed spending limit.
 *
 * Run: bun run examples/08-cost-budget.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const qualityScore = (temperature: number, rerankDepth: number, maxTokens: number): number =>
  Num.sumAll(Arr.make(
    Num.subtract(1, Numeric.abs(Num.subtract(temperature, 0.65))),
    Numeric.min(Num.unsafeDivide(rerankDepth, 30), 1),
    Num.multiply(Numeric.min(Num.unsafeDivide(maxTokens, 2048), 1), 0.2)
  ))

const estimatedCostUsd = (maxTokens: number, rerankDepth: number): number =>
  Num.sum(Num.multiply(maxTokens, 0.000004), Num.multiply(rerankDepth, 0.01))

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0.0, 1.2),
    maxTokens: SearchSpace.int(256, 2048, { step: 256 }),
    rerankDepth: SearchSpace.int(5, 30, { step: 5 })
  })

  const result = yield* Optimization.maximize({
    space,
    sampler: Sampler.tpe({ seed: 88 }),
    trials: 200,
    maxCost: 25,
    objective: (config) =>
      Effect.succeed(
        new Optimization.ObjectiveReport({
          value: qualityScore(config.temperature, config.rerankDepth, config.maxTokens),
          cost: estimatedCostUsd(config.maxTokens, config.rerankDepth)
        })
      )
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Budget-aware optimization complete", {
          completionReason,
          bestQuality: bestTrial.state.value,
          bestConfig: bestTrial.config,
          trialsEvaluated: Iterable.size(trials)
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
