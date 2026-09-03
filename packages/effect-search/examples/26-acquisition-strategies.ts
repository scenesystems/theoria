/**
 * Runs TPE with expected improvement, probability of improvement, and Thompson
 * acquisition against identical spaces, seeds, and trial counts.
 *
 * Run: bun run examples/26-acquisition-strategies.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const trialCount = 45

const objective = (config: {
  readonly x: number
  readonly y: number
  readonly depth: number
}): number =>
  Numeric.pow(config.x - 1.4, 2)
  + Numeric.pow(config.y + 0.8, 2) * 0.6
  + Numeric.pow((config.depth - 4) / 4, 2) * 0.1

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
