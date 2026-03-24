/**
 * Multi-Objective Optimization — find trade-offs between quality and latency.
 *
 * Uses MOTPE to discover Pareto-optimal configurations where
 * improving one objective necessarily worsens another.
 *
 * What this shows: returning multiple objectives and reading Pareto trade-offs instead of a single winner.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/04-multi-objective.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Match, Option } from "effect"

import { Contracts, Sampler, SearchSpace, Study } from "effect-search"

const latencyCost: Readonly<Record<string, number>> = {
  baseline: 0.3,
  detailed: 1.2,
  socratic: 2.1,
  none: 0.1,
  few: 0.6,
  curated: 1.3,
  strict: 1.1,
  balanced: 0.5,
  recall: 0.2
}

const qualityLoss: Readonly<Record<string, number>> = {
  baseline: 2.0,
  detailed: 0.8,
  socratic: 0.5,
  none: 1.8,
  few: 0.9,
  curated: 0.2,
  strict: 0.4,
  balanced: 0.9,
  recall: 1.4
}

const formatValue = (values: ReadonlyArray<number>, index: number): string =>
  Option.match(Arr.get(values, index), {
    onNone: () => "?",
    onSome: (n) => n.toFixed(1)
  })

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    instruction: SearchSpace.categorical(["baseline", "detailed", "socratic"]),
    demos: SearchSpace.categorical(["none", "few", "curated"]),
    scoring: SearchSpace.categorical(["strict", "balanced", "recall"])
  })

  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 919 }),
    directions: ["minimize", "minimize"],
    trials: 27,
    objective: (config) => {
      const latency = (latencyCost[config.instruction] ?? 0)
        + (latencyCost[config.demos] ?? 0)
        + (latencyCost[config.scoring] ?? 0)
      const quality = (qualityLoss[config.instruction] ?? 0)
        + (qualityLoss[config.demos] ?? 0)
        + (qualityLoss[config.scoring] ?? 0)
      return Effect.succeed([latency, quality])
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("MultiObjective", (r) =>
      Effect.gen(function*() {
        yield* Effect.log("Pareto front discovered", r.paretoFront.length)

        yield* Effect.forEach(r.paretoFront, (trial) =>
          Effect.gen(function*() {
            const values = Contracts.normalizeObjectiveVector(trial.state.value)
            yield* Effect.log("Pareto solution", {
              latency: formatValue(values, 0),
              qualityLoss: formatValue(values, 1),
              config: trial.config
            })
          }), { discard: true })

        yield* Effect.log("Evaluation complete", r.trials.length)
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
