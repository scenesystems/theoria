/**
 * Sampler Comparison — random vs TPE on the same problem.
 *
 * Demonstrates how TPE learns from trial history to find better
 * configurations in fewer trials compared to random search.
 *
 * What this shows: running the same objective with Random and TPE to compare search quality directly.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/06-sampler-comparison.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const simulatedLoss = (
  learningRate: number,
  dropout: number,
  hiddenSize: number,
  activation: "relu" | "gelu" | "silu"
): number => {
  const lrPenalty = (Math.log10(learningRate) - Math.log10(0.003)) ** 2
  const dropoutPenalty = (dropout - 0.1) ** 2
  const sizePenalty = ((hiddenSize - 256) / 256) ** 2
  const activationBonus = Match.value(activation).pipe(
    Match.when("gelu", () => -0.1),
    Match.when("silu", () => -0.05),
    Match.orElse(() => 0)
  )
  return 0.5 + lrPenalty * 0.3 + dropoutPenalty * 0.5 + sizePenalty * 0.2 + activationBonus
}

const trialCount = 40

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-5, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0.0, 0.5),
    hiddenSize: SearchSpace.int(32, 512, { step: 32 }),
    activation: SearchSpace.categorical(["relu", "gelu", "silu"])
  })

  const runStudy = (name: string, sampler: Sampler.Sampler) =>
    Study.minimize({
      space,
      sampler,
      objective: (config) =>
        Effect.succeed(simulatedLoss(config.learningRate, config.dropout, config.hiddenSize, config.activation)),
      trials: trialCount
    }).pipe(
      Effect.map((result) =>
        Match.value(result).pipe(
          Match.tag("SingleObjective", (single) => ({ name, bestValue: single.bestTrial.state.value })),
          Match.tag("MultiObjective", () => ({ name, bestValue: Infinity })),
          Match.exhaustive
        )
      )
    )

  yield* Effect.log("Comparing samplers", { trials: trialCount })

  const randomResult = yield* runStudy("Random", Sampler.random({ seed: 42 }))
  const tpeResult = yield* runStudy("TPE", Sampler.tpe({ seed: 42, nStartupTrials: 10 }))

  const improvement = ((randomResult.bestValue - tpeResult.bestValue) / randomResult.bestValue) * 100

  yield* Effect.log("Comparison results", {
    randomBestLoss: randomResult.bestValue.toFixed(6),
    tpeBestLoss: tpeResult.bestValue.toFixed(6),
    tpeImprovement: improvement > 0
      ? improvement.toFixed(1) + "%"
      : "Random outperformed (TPE needs more trials)"
  })
})

BunRuntime.runMain(program)
