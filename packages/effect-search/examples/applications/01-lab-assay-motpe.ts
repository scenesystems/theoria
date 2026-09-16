/**
 * Searches assay recipes with MOTPE and logs non-dominated combinations of
 * assay error, modeled contamination risk, and protocol runtime. All three
 * objectives are minimized.
 *
 * Run: bun run examples/applications/01-lab-assay-motpe.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Option } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Objective, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    ph: SearchSpace.float(6.8, 8.2),
    temperatureC: SearchSpace.float(20, 42),
    incubationMinutes: SearchSpace.int(15, 120, { step: 5 }),
    reagentDose: SearchSpace.float(0.2, 2.0),
    washCycles: SearchSpace.int(1, 6)
  })
  const assayErrorScore = (config: SearchSpace.Type<typeof space>): number =>
    Numeric.pow(config.ph - 7.35, 2) * 10
    + Numeric.pow(config.temperatureC - 33.5, 2) / 22
    + Numeric.pow(config.reagentDose - 1.05, 2) * 3.8
    + Numeric.pow(config.incubationMinutes - 58, 2) / 420
    + Numeric.abs((config.temperatureC - 33.5) * (config.reagentDose - 1.05)) / 26
  const contaminationRiskScore = (config: SearchSpace.Type<typeof space>): number =>
    0.06
    + Numeric.abs(config.ph - 7.2) * 0.12
    + (config.temperatureC > 37 ? (config.temperatureC - 37) * 0.02 : 0)
    + config.washCycles * 0.015
    + (config.reagentDose < 0.55 ? (0.55 - config.reagentDose) * 0.2 : 0)
  const protocolRuntimeMinutes = (config: SearchSpace.Type<typeof space>): number =>
    config.incubationMinutes + config.washCycles * 6 + (config.temperatureC > 38 ? 4 : 0)

  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 2601, multivariate: true, noiseAware: true }),
    directions: ["minimize", "minimize", "minimize"],
    trials: 72,
    objective: (config) => {
      const assayError = assayErrorScore(config)
      const contaminationRisk = contaminationRiskScore(config)
      const throughputMinutes = protocolRuntimeMinutes(config)

      return Effect.succeed([assayError, contaminationRisk, throughputMinutes])
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
          const formatValue = (index: number, digits: number) =>
            Option.match(Arr.get(values, index), {
              onNone: () => "unavailable",
              onSome: (value) => value.toFixed(digits)
            })

          return Effect.log("Pareto protocol", {
            assayError: formatValue(0, 3),
            contaminationRisk: formatValue(1, 3),
            throughputMinutes: formatValue(2, 1),
            config: trial.config
          })
        }, { discard: true })
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
