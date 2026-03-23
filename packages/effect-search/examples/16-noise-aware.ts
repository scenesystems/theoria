/**
 * Noise-Aware TPE — robust suggestions for stochastic objectives.
 *
 * Real use case: tune LLM prompts where repeated evaluations vary in score.
 *
 * What this shows: noise-aware TPE with repeated evaluations per trial for stochastic objectives.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/16-noise-aware.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number as Num, Ref } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0, 0.4)
  })
  const objectiveCallsRef = yield* Ref.make(0)

  const noisyObjective = (config: SearchSpace.Type<typeof space>) =>
    Ref.updateAndGet(objectiveCallsRef, Num.increment).pipe(
      Effect.map((callIndex) => {
        const stableTerm = (config.learningRate - 0.03) ** 2 + (config.dropout - 0.15) ** 2
        const deterministicNoise = Math.sin(callIndex * 0.7) * 0.05 + Math.cos(callIndex * 0.3) * 0.03

        return stableTerm + deterministicNoise
      })
    )

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 117,
      noiseAware: true,
      noiseAlpha: 2
    }),
    trials: 40,
    evaluationsPerTrial: 3,
    objective: noisyObjective
  })
  const objectiveCalls = yield* Ref.get(objectiveCallsRef)

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Noise-aware optimization complete", {
          completionReason,
          trialsEvaluated: trials.length,
          objectiveCalls,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config,
          varianceEstimate: bestTrial.state.variance
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
