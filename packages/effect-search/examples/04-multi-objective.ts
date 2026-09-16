/**
 * Uses MOTPE to find non-dominated quality and latency configurations, then
 * logs the resulting Pareto front.
 *
 * Run: bun run examples/04-multi-objective.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Number as Num, Option, Record, Tuple } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { type Direction, Objective, Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

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

const formatValue = (values: Objective.Vector, index: number): string =>
  Option.match(Arr.get(values, index), {
    onNone: () => "?",
    onSome: (n) => String(Numeric.round(n, 1))
  })

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    instruction: SearchSpace.categorical(Tuple.make("baseline", "detailed", "socratic")),
    demos: SearchSpace.categorical(Tuple.make("none", "few", "curated")),
    scoring: SearchSpace.categorical(Tuple.make("strict", "balanced", "recall"))
  })

  const result = yield* Optimization.run({
    space,
    sampler: Sampler.tpe({ seed: 919 }),
    directions: Arr.replicate<Direction.Direction>("minimize", 2),
    trials: 27,
    objective: (config) => {
      const valueOrZero = (values: Readonly<Record<string, number>>, key: string) =>
        Option.getOrElse(Record.get(values, key), () => 0)
      const latency = Num.sumAll(Arr.make(
        valueOrZero(latencyCost, config.instruction),
        valueOrZero(latencyCost, config.demos),
        valueOrZero(latencyCost, config.scoring)
      ))
      const quality = Num.sumAll(Arr.make(
        valueOrZero(qualityLoss, config.instruction),
        valueOrZero(qualityLoss, config.demos),
        valueOrZero(qualityLoss, config.scoring)
      ))
      return Effect.succeed(Tuple.make(latency, quality))
    }
  })

  yield* Match.value(result).pipe(
    Match.tag("MultiObjective", (r) =>
      Effect.gen(function*() {
        yield* Effect.log("Pareto front discovered", Iterable.size(r.paretoFront))

        yield* Effect.forEach(r.paretoFront, (trial) =>
          Effect.gen(function*() {
            const values = Objective.toVector(trial.state.value)
            yield* Effect.log("Pareto solution", {
              latency: formatValue(values, 0),
              qualityLoss: formatValue(values, 1),
              config: trial.config
            })
          }), { discard: true })

        yield* Effect.log("Evaluation complete", Iterable.size(r.trials))
      })),
    Match.tag("SingleObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
