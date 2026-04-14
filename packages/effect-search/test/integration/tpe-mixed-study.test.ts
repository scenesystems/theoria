import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import { abs, logStrict } from "effect-math/Numeric"

import { decodeMixedOptimizerConfig, MixedOptimizerSpace } from "../../src/experimental/scenarios/mixedOptimizer.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as Study from "../../src/Study/index.js"

const ScenarioSchema = Schema.Struct({
  label: Schema.String,
  seed: Schema.Number,
  startupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  trials: Schema.Number
})

const stressScenarios = Schema.decodeUnknownSync(Schema.Array(ScenarioSchema))([
  {
    label: "baseline-mixed",
    seed: 177,
    startupTrials: 4,
    nEiCandidates: 16,
    trials: 8
  },
  {
    label: "aggressive-ei",
    seed: 2,
    startupTrials: 4,
    nEiCandidates: 20,
    trials: 10
  }
])

const optimizerPenalty = (optimizer: "adam" | "sgd" | "adamw"): number =>
  optimizer === "adamw" ? 0 : optimizer === "adam" ? 0.2 : 0.65

const objectiveValue = (raw: unknown): number => {
  const config = decodeMixedOptimizerConfig(raw)

  return (
    abs(logStrict(config.lr) - logStrict(0.02)) +
    abs(config.depth - 5) * 0.25 +
    optimizerPenalty(config.optimizer)
  )
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const traceFor = (result: Study.SingleObjectiveResult) => result.trials.map((trial) => trial.config)

const optimizeWith = (sampler: Sampler.Sampler, trials: number) =>
  Study.optimize({
    space: MixedOptimizerSpace.make(),
    sampler,
    direction: "minimize",
    trials,
    objective: (raw) => Effect.succeed(objectiveValue(raw))
  })

describe("integration mixed-space tpe study", () => {
  it.effect(
    "matches random during startup and diverges post-startup across stress scenarios",
    () =>
      Effect.gen(function*() {
        yield* Effect.forEach(
          stressScenarios,
          (scenario) =>
            Effect.gen(function*() {
              const tpeResult = yield* optimizeWith(
                Sampler.tpe({
                  seed: scenario.seed,
                  nStartupTrials: scenario.startupTrials,
                  nEiCandidates: scenario.nEiCandidates
                }),
                scenario.trials
              )
              const randomResult = yield* optimizeWith(Sampler.random({ seed: scenario.seed }), scenario.trials)
              const tpeOption = asSingleObjective(tpeResult)
              const randomOption = asSingleObjective(randomResult)

              expect(Option.isSome(tpeOption), scenario.label).toBe(true)
              expect(Option.isSome(randomOption), scenario.label).toBe(true)

              if (Option.isNone(tpeOption) || Option.isNone(randomOption)) {
                return
              }

              const startupTpeConfigs = tpeOption.value.trials
                .slice(0, scenario.startupTrials)
                .map((trial) => trial.config)
              const startupRandomConfigs = randomOption.value.trials
                .slice(0, scenario.startupTrials)
                .map((trial) => trial.config)
              const postStartupTpeConfigs = tpeOption.value.trials
                .slice(scenario.startupTrials)
                .map((trial) => trial.config)
              const postStartupRandomConfigs = randomOption.value.trials
                .slice(scenario.startupTrials)
                .map((trial) => trial.config)

              expect(startupTpeConfigs, scenario.label).toEqual(startupRandomConfigs)
              expect(postStartupTpeConfigs, scenario.label).not.toEqual(postStartupRandomConfigs)
            }),
          { discard: true }
        )
      })
  )

  it.effect(
    "replays deterministically and stays competitive versus random across stress scenarios",
    () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach(
          stressScenarios,
          (scenario) =>
            Effect.gen(function*() {
              const tpeResultA = yield* optimizeWith(
                Sampler.tpe({
                  seed: scenario.seed,
                  nStartupTrials: scenario.startupTrials,
                  nEiCandidates: scenario.nEiCandidates
                }),
                scenario.trials
              )
              const tpeResultB = yield* optimizeWith(
                Sampler.tpe({
                  seed: scenario.seed,
                  nStartupTrials: scenario.startupTrials,
                  nEiCandidates: scenario.nEiCandidates
                }),
                scenario.trials
              )
              const randomResult = yield* optimizeWith(Sampler.random({ seed: scenario.seed }), scenario.trials)
              const tpeOptionA = asSingleObjective(tpeResultA)
              const tpeOptionB = asSingleObjective(tpeResultB)
              const randomOption = asSingleObjective(randomResult)

              expect(Option.isSome(tpeOptionA), scenario.label).toBe(true)
              expect(Option.isSome(tpeOptionB), scenario.label).toBe(true)
              expect(Option.isSome(randomOption), scenario.label).toBe(true)

              if (Option.isNone(tpeOptionA) || Option.isNone(tpeOptionB) || Option.isNone(randomOption)) {
                return {
                  label: scenario.label,
                  tpeBest: Number.POSITIVE_INFINITY,
                  randomBest: Number.POSITIVE_INFINITY
                }
              }

              expect(traceFor(tpeOptionA.value), scenario.label).toEqual(traceFor(tpeOptionB.value))

              return {
                label: scenario.label,
                tpeBest: tpeOptionA.value.bestTrial.state.value,
                randomBest: randomOption.value.bestTrial.state.value
              }
            }),
          { discard: false }
        )

        const deltas = results.map((result) => ({
          label: result.label,
          delta: result.tpeBest - result.randomBest
        }))
        const hasBetterOrEqual = deltas.some((entry) => entry.delta <= 0)
        const maxRegression = deltas.reduce(
          (currentMax, entry) => currentMax > entry.delta ? currentMax : entry.delta,
          Number.NEGATIVE_INFINITY
        )

        expect(hasBetterOrEqual).toBe(true)
        // Joint candidate scoring is less greedy than per-dimension argmax and can accept
        // a bounded regression on some stress slices while still producing competitive runs.
        expect(maxRegression).toBeLessThanOrEqual(0.25)
      })
  )
})
