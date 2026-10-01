/**
 * Runs Random and TPE against the same mixed objective, then runs Random,
 * CMA-ES, and GP-BO against the same continuous objective.
 *
 * Run: bun run examples/06-sampler-comparison.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Effect, Match, Number as Num, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const simulatedLoss = (
  learningRate: number,
  dropout: number,
  hiddenSize: number,
  activation: "relu" | "gelu" | "silu"
): number => {
  const lrPenalty = Numeric.pow(Num.subtract(Numeric.log10(learningRate), Numeric.log10(0.003)), 2)
  const dropoutPenalty = Numeric.pow(Num.subtract(dropout, 0.1), 2)
  const sizePenalty = Numeric.pow(Num.unsafeDivide(Num.subtract(hiddenSize, 256), 256), 2)
  const activationBonus = Match.value(activation).pipe(
    Match.when("gelu", () => -0.1),
    Match.when("silu", () => -0.05),
    Match.orElse(() => 0)
  )
  return Num.sumAll(Arr.make(
    0.5,
    Num.multiply(lrPenalty, 0.3),
    Num.multiply(dropoutPenalty, 0.5),
    Num.multiply(sizePenalty, 0.2),
    activationBonus
  ))
}

const trialCount = 40

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-5, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0.0, 0.5),
    hiddenSize: SearchSpace.int(32, 512, { step: 32 }),
    activation: SearchSpace.categorical(Tuple.make<[
      "relu",
      "gelu",
      "silu"
    ]>("relu", "gelu", "silu"))
  })

  const runOptimization = (name: string, sampler: Sampler.Sampler) =>
    Optimization.minimize({
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

  const continuousSpace = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-5, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0.0, 0.5)
  })

  const runContinuousOptimization = (name: string, sampler: Sampler.Sampler) =>
    Optimization.minimize({
      space: continuousSpace,
      sampler,
      objective: (config) =>
        Effect.succeed(
          Num.sum(
            Numeric.pow(Num.subtract(Numeric.log10(config.learningRate), Numeric.log10(0.003)), 2),
            Numeric.pow(Num.subtract(config.dropout, 0.1), 2)
          )
        ),
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

  const randomResult = yield* runOptimization("Random", Sampler.random({ seed: 42 }))
  const tpeResult = yield* runOptimization("TPE", Sampler.tpe({ seed: 42, nStartupTrials: 10 }))

  const improvement = Num.multiply(
    Num.unsafeDivide(Num.subtract(randomResult.bestValue, tpeResult.bestValue), randomResult.bestValue),
    100
  )

  yield* Effect.log("Comparison results", {
    randomBestLoss: Numeric.round(randomResult.bestValue, 6),
    tpeBestLoss: Numeric.round(tpeResult.bestValue, 6),
    tpeImprovement: Bool.match(Num.greaterThan(improvement, 0), {
      onFalse: () => "Random outperformed (TPE needs more trials)",
      onTrue: () => `${Numeric.round(improvement, 1)}%`
    })
  })

  const continuousRandom = yield* runContinuousOptimization("Random (continuous)", Sampler.random({ seed: 42 }))
  const cmaResult = yield* runContinuousOptimization(
    "CMA-ES",
    Sampler.cmaEs({ seed: 42, sigma: 0.45, populationSize: 10 })
  )
  const gpResult = yield* runContinuousOptimization(
    "GP-BO",
    Sampler.gpBo({
      seed: 42,
      nStartupTrials: 8,
      nCandidates: 24,
      acquisition: "ei"
    })
  )

  yield* Effect.log("Continuous comparison results", {
    randomBestLoss: Numeric.round(continuousRandom.bestValue, 6),
    cmaEsBestLoss: Numeric.round(cmaResult.bestValue, 6),
    gpBoBestLoss: Numeric.round(gpResult.bestValue, 6)
  })
})

BunRuntime.runMain(program)
