/**
 * Acquisition Strategies (EI, PI, Thompson) — compare TPE acquisition modes.
 *
 * Real use case: choose exploration behavior for noisy or irregular objectives
 * without changing the rest of the optimization pipeline.
 *
 * What this shows: `Sampler.tpe({ acquisition: ... })` with built-in
 * `"ei"`, `"pi"`, and `"thompson"` strategies under identical settings.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/26-acquisition-strategies.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const trialCount = 45

const objective = (config: {
  readonly x: number
  readonly y: number
  readonly depth: number
}): number =>
  (config.x - 1.4) ** 2
  + ((config.y + 0.8) ** 2) * 0.6
  + ((config.depth - 4) / 4) ** 2 * 0.1

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-3, 3),
    y: SearchSpace.float(-3, 3),
    depth: SearchSpace.int(1, 8)
  })

  const runWithAcquisition = (name: "ei" | "pi" | "thompson") =>
    Study.minimize({
      space,
      sampler: Sampler.tpe({
        seed: 260,
        nStartupTrials: 8,
        nEiCandidates: 30,
        acquisition: name
      }),
      trials: trialCount,
      objective: (config) => Effect.succeed(objective(config))
    }).pipe(
      Effect.map((result) =>
        Match.value(result).pipe(
          Match.tag("SingleObjective", ({ bestTrial }) => ({
            name,
            bestValue: bestTrial.state.value,
            bestConfig: bestTrial.config
          })),
          Match.tag("MultiObjective", () => ({
            name,
            bestValue: Number.POSITIVE_INFINITY,
            bestConfig: "not-applicable"
          })),
          Match.exhaustive
        )
      )
    )

  const ei = yield* runWithAcquisition("ei")
  const pi = yield* runWithAcquisition("pi")
  const thompson = yield* runWithAcquisition("thompson")

  yield* Effect.log("Acquisition strategy comparison", {
    trials: trialCount,
    eiBestValue: ei.bestValue,
    piBestValue: pi.bestValue,
    thompsonBestValue: thompson.bestValue,
    eiBestConfig: ei.bestConfig,
    piBestConfig: pi.bestConfig,
    thompsonBestConfig: thompson.bestConfig
  })
})

BunRuntime.runMain(program)
