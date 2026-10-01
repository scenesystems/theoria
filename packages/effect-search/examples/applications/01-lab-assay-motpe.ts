/**
 * Searches assay recipes with MOTPE and logs non-dominated combinations of
 * assay error, modeled contamination risk, and protocol runtime. All three
 * objectives are minimized.
 *
 * Run: bun run examples/applications/01-lab-assay-motpe.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Effect, Iterable, Match, Number as Num, Option, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { type Direction, Objective, Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    ph: SearchSpace.float(6.8, 8.2),
    temperatureC: SearchSpace.float(20, 42),
    incubationMinutes: SearchSpace.int(15, 120, { step: 5 }),
    reagentDose: SearchSpace.float(0.2, 2.0),
    washCycles: SearchSpace.int(1, 6)
  })
  const assayErrorScore = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      Num.multiply(Numeric.pow(Num.subtract(config.ph, 7.35), 2), 10),
      Num.unsafeDivide(Numeric.pow(Num.subtract(config.temperatureC, 33.5), 2), 22),
      Num.multiply(Numeric.pow(Num.subtract(config.reagentDose, 1.05), 2), 3.8),
      Num.unsafeDivide(Numeric.pow(Num.subtract(config.incubationMinutes, 58), 2), 420),
      Num.unsafeDivide(
        Numeric.abs(
          Num.multiply(Num.subtract(config.temperatureC, 33.5), Num.subtract(config.reagentDose, 1.05))
        ),
        26
      )
    ))
  const contaminationRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      0.06,
      Num.multiply(Numeric.abs(Num.subtract(config.ph, 7.2)), 0.12),
      Bool.match(Num.greaterThan(config.temperatureC, 37), {
        onFalse: () => 0,
        onTrue: () => Num.multiply(Num.subtract(config.temperatureC, 37), 0.02)
      }),
      Num.multiply(config.washCycles, 0.015),
      Bool.match(Num.lessThan(config.reagentDose, 0.55), {
        onFalse: () => 0,
        onTrue: () => Num.multiply(Num.subtract(0.55, config.reagentDose), 0.2)
      })
    ))
  const protocolRuntimeMinutes = (config: SearchSpace.Type<typeof space>): number =>
    Num.sumAll(Arr.make(
      config.incubationMinutes,
      Num.multiply(config.washCycles, 6),
      Bool.match(Num.greaterThan(config.temperatureC, 38), { onFalse: () => 0, onTrue: () => 4 })
    ))

  const result = yield* Optimization.run({
    space,
    sampler: Sampler.tpe({ seed: 2601, multivariate: true, noiseAware: true }),
    directions: Arr.replicate<Direction.Direction>("minimize", 3),
    trials: 72,
    objective: (config) => {
      const assayError = assayErrorScore(config)
      const contaminationRisk = contaminationRiskScore(config)
      const throughputMinutes = protocolRuntimeMinutes(config)

      return Effect.succeed(Tuple.make(assayError, contaminationRisk, throughputMinutes))
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("MultiObjective", ({ paretoFront, completionReason, trials }) =>
      Effect.gen(function*() {
        yield* Effect.log("Lab assay MOTPE complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          paretoFrontSize: Iterable.size(paretoFront)
        })

        // Show the first handful of non-dominated protocols for manual bench review.
        yield* Effect.forEach(Arr.take(paretoFront, 6), (trial) => {
          const values = Objective.toVector(trial.state.value)
          const formatValue = (index: number) =>
            Option.match(Arr.get(values, index), {
              onNone: () => "unavailable",
              onSome: (value) => value
            })

          return Effect.log("Pareto protocol", {
            assayError: formatValue(0),
            contaminationRisk: formatValue(1),
            throughputMinutes: formatValue(2),
            config: trial.config
          })
        }, { discard: true })
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
