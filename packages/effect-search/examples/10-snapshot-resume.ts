/**
 * Serializes a completed optimization snapshot and resumes compatible optimization
 * from its next trial number.
 *
 * Run: bun run examples/10-snapshot-resume.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match, Number as Num, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationSnapshot, Sampler, SearchSpace } from "@scenesystems/effect-search"

const objectiveValue = (x: number, y: number): number =>
  Num.sum(Numeric.pow(Num.subtract(x, 1.25), 2), Numeric.pow(Num.sum(y, 0.8), 2))

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.y))

  const firstLeg = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({ seed: 404 }),
    trials: 20,
    objective
  })

  const snapshot = yield* Optimization.snapshot(firstLeg)
  const encoded = yield* Schema.encode(OptimizationSnapshot.OptimizationSnapshot)(snapshot)
  const restored = yield* Schema.decode(OptimizationSnapshot.OptimizationSnapshot)(encoded)

  const resumed = yield* Optimization.resume({
    space,
    sampler: Sampler.tpe({ seed: 404 }),
    snapshot: restored,
    direction: "minimize",
    trials: 20,
    objective
  })

  yield* Match.value(resumed).pipe(
    Match.tag("SingleObjective", ({ bestTrial, completionReason, trials }) =>
      Effect.log("Snapshot resume complete", {
        resumedFromTrial: snapshot.nextTrialNumber,
        completionReason,
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config,
        totalTrials: Iterable.size(trials)
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
