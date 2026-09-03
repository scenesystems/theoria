/**
 * Tunes generation settings while each objective report contributes estimated
 * cost toward the study's fixed spending limit.
 *
 * Run: bun run examples/08-cost-budget.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const qualityScore = (temperature: number, rerankDepth: number, maxTokens: number): number =>
  (1 - Numeric.abs(temperature - 0.65))
  + Numeric.min(rerankDepth / 30, 1)
  + Numeric.min(maxTokens / 2048, 1) * 0.2

const estimatedCostUsd = (maxTokens: number, rerankDepth: number): number => maxTokens * 0.000004 + rerankDepth * 0.01

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0.0, 1.2),
    maxTokens: SearchSpace.int(256, 2048, { step: 256 }),
    rerankDepth: SearchSpace.int(5, 30, { step: 5 })
  })

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 88 }),
    trials: 200,
    maxCost: 25,
    objective: (config) =>
      Effect.succeed(
        new Study.ObjectiveReport({
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
          trialsEvaluated: trials.length
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
