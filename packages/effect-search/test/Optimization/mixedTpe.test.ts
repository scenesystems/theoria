import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import { decodeMixedOptimizerConfig, makeMixedOptimizerSpace } from "../fixtures/scenarios/mixedOptimizer.js"

const ScenarioSchema = Schema.Struct({
  label: Schema.String,
  seed: Schema.Number,
  startupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  trials: Schema.Number
})

const stressScenarios = Schema.decodeUnknownSync(Schema.Array(ScenarioSchema))(Arr.make(
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
))

const optimizerPenalty = (optimizer: "adam" | "sgd" | "adamw"): number =>
  Match.value(optimizer).pipe(
    Match.when("adamw", () => 0),
    Match.when("adam", () => 0.2),
    Match.orElse(() => 0.65)
  )

const objectiveValue = (raw: unknown) =>
  Effect.gen(function*() {
    const config = yield* decodeMixedOptimizerConfig(raw)

    return Num.sumAll(Arr.make(
      Numeric.abs(Num.subtract(Numeric.logStrict(config.lr), Numeric.logStrict(0.02))),
      Num.multiply(Numeric.abs(Num.subtract(config.depth, 5)), 0.25),
      optimizerPenalty(config.optimizer)
    ))
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const traceFor = (result: Optimization.SingleObjectiveResult) =>
  Arr.map(Arr.fromIterable(result.trials), (trial) => trial.config)

const runWith = (sampler: Sampler.Sampler, trials: number) =>
  Effect.gen(function*() {
    const space = yield* makeMixedOptimizerSpace()
    return yield* Optimization.run({
      space,
      sampler,
      direction: "minimize",
      trials,
      objective: objectiveValue
    })
  })

describe("integration mixed-space tpe optimization", () => {
  it.effect(
    "matches random during startup and diverges post-startup across stress scenarios",
    () =>
      Effect.forEach(
        stressScenarios,
        (scenario) =>
          Effect.gen(function*() {
            const tpeResult = yield* runWith(
              Sampler.tpe({
                seed: scenario.seed,
                nStartupTrials: scenario.startupTrials,
                nEiCandidates: scenario.nEiCandidates
              }),
              scenario.trials
            )
            const randomResult = yield* runWith(Sampler.random({ seed: scenario.seed }), scenario.trials)
            const tpeOption = asSingleObjective(tpeResult)
            const randomOption = asSingleObjective(randomResult)

            expect(Option.isSome(tpeOption), scenario.label).toBe(true)
            expect(Option.isSome(randomOption), scenario.label).toBe(true)
            const tpe = yield* tpeOption
            const random = yield* randomOption

            const tpeTrials = Arr.fromIterable(tpe.trials)
            const randomTrials = Arr.fromIterable(random.trials)
            const startupTpeConfigs = Arr.map(Arr.take(tpeTrials, scenario.startupTrials), (trial) => trial.config)
            const startupRandomConfigs = Arr.map(
              Arr.take(randomTrials, scenario.startupTrials),
              (trial) => trial.config
            )
            const postStartupTpeConfigs = Arr.map(Arr.drop(tpeTrials, scenario.startupTrials), (trial) => trial.config)
            const postStartupRandomConfigs = Arr.map(
              Arr.drop(randomTrials, scenario.startupTrials),
              (trial) => trial.config
            )

            expect(startupTpeConfigs, scenario.label).toEqual(startupRandomConfigs)
            expect(postStartupTpeConfigs, scenario.label).not.toEqual(postStartupRandomConfigs)
          }),
        { discard: true }
      )
  )

  it.effect(
    "replays deterministically and stays competitive versus random across stress scenarios",
    () =>
      Effect.gen(function*() {
        const results = yield* Effect.forEach(
          stressScenarios,
          (scenario) =>
            Effect.gen(function*() {
              const tpeResultA = yield* runWith(
                Sampler.tpe({
                  seed: scenario.seed,
                  nStartupTrials: scenario.startupTrials,
                  nEiCandidates: scenario.nEiCandidates
                }),
                scenario.trials
              )
              const tpeResultB = yield* runWith(
                Sampler.tpe({
                  seed: scenario.seed,
                  nStartupTrials: scenario.startupTrials,
                  nEiCandidates: scenario.nEiCandidates
                }),
                scenario.trials
              )
              const randomResult = yield* runWith(Sampler.random({ seed: scenario.seed }), scenario.trials)
              const tpeOptionA = asSingleObjective(tpeResultA)
              const tpeOptionB = asSingleObjective(tpeResultB)
              const randomOption = asSingleObjective(randomResult)

              expect(Option.isSome(tpeOptionA), scenario.label).toBe(true)
              expect(Option.isSome(tpeOptionB), scenario.label).toBe(true)
              expect(Option.isSome(randomOption), scenario.label).toBe(true)
              const tpeA = yield* tpeOptionA
              const tpeB = yield* tpeOptionB
              const random = yield* randomOption

              expect(traceFor(tpeA), scenario.label).toEqual(traceFor(tpeB))

              return {
                label: scenario.label,
                tpeBest: tpeA.bestTrial.state.value,
                randomBest: random.bestTrial.state.value
              }
            }),
          { discard: false }
        )

        const deltas = Arr.map(results, (result) => ({
          label: result.label,
          delta: Num.subtract(result.tpeBest, result.randomBest)
        }))
        const hasBetterOrEqual = Arr.some(deltas, (entry) => Num.lessThanOrEqualTo(entry.delta, 0))
        const maxRegression = Arr.reduce(deltas, Number.NEGATIVE_INFINITY, (currentMax, entry) =>
          Num.max(currentMax, entry.delta))

        expect(hasBetterOrEqual).toBe(true)
        // Joint candidate scoring is less greedy than per-dimension argmax and can accept
        // a bounded regression on some stress slices while still producing competitive runs.
        expect(maxRegression).toBeLessThanOrEqual(0.25)
      })
  )
})
