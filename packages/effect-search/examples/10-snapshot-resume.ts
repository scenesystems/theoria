/**
 * Snapshot + Resume — continue optimization from serialized machine state.
 *
 * Real use case: checkpoint overnight and resume in the next process.
 *
 * What this shows: serializing study state to a snapshot and resuming later with compatible settings.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/10-snapshot-resume.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Schema } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const objectiveValue = (x: number, y: number): number => (x - 1.25) ** 2 + (y + 0.8) ** 2

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.y))

  const firstLeg = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 404 }),
    trials: 20,
    objective
  })

  const snapshot = yield* Study.snapshot(firstLeg)
  const encoded = yield* Schema.encode(Study.StudySnapshot)(snapshot)
  const restored = yield* Schema.decode(Study.StudySnapshot)(encoded)

  const resumed = yield* Study.resume({
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
        totalTrials: trials.length
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
