/**
 * Prompt Tuning — find the best prompt configuration for an LLM task.
 *
 * This example simulates scoring different prompt configurations.
 * In production, the objective would call an LLM and evaluate the response.
 *
 * What this shows: optimizing prompt knobs (temperature, style, few-shot count, token budget) with one quality score.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/02-prompt-tuning.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const promptQuality = (config: {
  readonly temperature: number
  readonly systemPrompt: "concise" | "detailed" | "step-by-step"
  readonly fewShotCount: number
  readonly maxTokens: number
}): number => {
  const tempScore = 1 - Math.abs(config.temperature - 0.7)
  const styleScore = Match.value(config.systemPrompt).pipe(
    Match.when("step-by-step", () => 0.9),
    Match.when("detailed", () => 0.7),
    Match.orElse(() => 0.5)
  )
  const demoScore = Math.min(config.fewShotCount * 0.15, 0.6)
  const tokenScore = Math.min(config.maxTokens / 2048, 1.0) * 0.3
  return tempScore + styleScore + demoScore + tokenScore
}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0.0, 1.5),
    systemPrompt: SearchSpace.categorical(["concise", "detailed", "step-by-step"]),
    fewShotCount: SearchSpace.int(0, 5),
    maxTokens: SearchSpace.int(256, 2048, { step: 256 })
  })

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) => Effect.succeed(promptQuality(config)),
    trials: 40
  })

  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason }) =>
      Effect.log("Best prompt configuration", {
        qualityScore: bestTrial.state.value,
        bestConfig: bestTrial.config,
        completionReason
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
