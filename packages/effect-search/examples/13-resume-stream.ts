/**
 * Resumes from a snapshot and consumes the resumed study's lifecycle events as
 * a stream.
 *
 * Run: bun run examples/13-resume-stream.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Effect, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const objectiveValue = (x: number, depth: number): number => Numeric.abs(x - 0.35) + depth * 0.05

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 4)
  })
  const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.depth))

  const baseline = yield* Study.minimize({
    space,
    sampler: Sampler.random({ seed: 813 }),
    trials: 6,
    objective
  })
  const snapshot = yield* Study.snapshot(baseline)

  const events = yield* Study.resumeStream({
    space,
    sampler: Sampler.random({ seed: 813 }),
    snapshot,
    direction: "minimize",
    trials: 4,
    objective
  }).pipe(
    Stream.tap((event) => Effect.log("Resume event", event._tag)),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  const studyCompletedEvents = events.filter((event) => event._tag === "StudyCompleted")

  yield* Effect.log("Resume stream complete", {
    resumedFromTrial: snapshot.nextTrialNumber,
    emittedEvents: events.length,
    studyCompletedEvents: studyCompletedEvents.length,
    lastEvent: events[events.length - 1]?._tag ?? "none"
  })
})

BunRuntime.runMain(program)
