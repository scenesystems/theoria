/**
 * Advanced Applications / 01 — Lab Assay Recipe Tuning.
 *
 * Plain-English goal:
 * Find assay settings that are accurate, safe, and fast.
 *
 * Use case:
 * You have several recipe knobs (`ph`, temperature, incubation time, dose,
 * and wash count). Improving one outcome can hurt another, so you want a
 * short list of good trade-off recipes rather than one single "winner".
 *
 * Why `effect-search`:
 * This is an expensive black-box problem with mixed variable types and noisy
 * measurements. The multi-objective study gives you a Pareto front directly.
 *
 * Objective semantics:
 * 1. `assayError` (lower is better): how far the run is from target behavior.
 * 2. `contaminationRisk` (lower is better): modeled instability/contamination risk.
 * 3. `throughputMinutes` (lower is better): total protocol runtime.
 *
 * What to expect in output:
 * A set of "Pareto protocol" rows. Each row is a valid trade-off candidate.
 * None is strictly better than all others on every metric.
 *
 * How to use the result:
 * Pick candidates based on your current phase (high-throughput screening,
 * precision validation, etc.) and validate those on real assays.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Contracts.ObjectiveVector}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/applications/01-lab-assay-motpe.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Contracts, Sampler, SearchSpace, Study } from "effect-search"

const assayErrorScore = (config: {
  readonly ph: number
  readonly temperatureC: number
  readonly incubationMinutes: number
  readonly reagentDose: number
}): number =>
  (config.ph - 7.35) ** 2 * 10
  + (config.temperatureC - 33.5) ** 2 / 22
  + (config.reagentDose - 1.05) ** 2 * 3.8
  + (config.incubationMinutes - 58) ** 2 / 420
  + Math.abs((config.temperatureC - 33.5) * (config.reagentDose - 1.05)) / 26

const contaminationRiskScore = (config: {
  readonly ph: number
  readonly temperatureC: number
  readonly reagentDose: number
  readonly washCycles: number
}): number =>
  0.06
  + Math.abs(config.ph - 7.2) * 0.12
  + (config.temperatureC > 37 ? (config.temperatureC - 37) * 0.02 : 0)
  + config.washCycles * 0.015
  + (config.reagentDose < 0.55 ? (0.55 - config.reagentDose) * 0.2 : 0)

const protocolRuntimeMinutes = (config: {
  readonly incubationMinutes: number
  readonly washCycles: number
  readonly temperatureC: number
}): number => config.incubationMinutes + config.washCycles * 6 + (config.temperatureC > 38 ? 4 : 0)

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    ph: SearchSpace.float(6.8, 8.2),
    temperatureC: SearchSpace.float(20, 42),
    incubationMinutes: SearchSpace.int(15, 120, { step: 5 }),
    reagentDose: SearchSpace.float(0.2, 2.0),
    washCycles: SearchSpace.int(1, 6)
  })

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
          trialsEvaluated: trials.length,
          paretoFrontSize: paretoFront.length
        })

        // Show the first handful of non-dominated protocols for manual bench review.
        yield* Effect.forEach(paretoFront.slice(0, 6), (trial) => {
          const values = Contracts.normalizeObjectiveVector(trial.state.value)

          return Effect.log("Pareto protocol", {
            assayError: values[0]?.toFixed(3),
            contaminationRisk: values[1]?.toFixed(3),
            throughputMinutes: values[2]?.toFixed(1),
            config: trial.config
          })
        }, { discard: true })
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
