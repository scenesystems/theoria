/**
 * Renders terminal progress for a new study and a resumed study while
 * collecting the unchanged event streams for inspection.
 *
 * Run: bun run examples/03-streaming-events.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Effect, Option, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Progress, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-10, 10),
    y: SearchSpace.float(-10, 10)
  })
  const objective = (config: SearchSpace.Type<typeof space>) =>
    Effect.succeed(
      Numeric.sin(config.x) * Numeric.cos(config.y)
        + Numeric.pow(config.x - 1, 2)
        + Numeric.pow(config.y + 2, 2)
    )

  yield* Effect.log("Starting optimizeStream run with terminal progress")

  const optimizeEvents = yield* Study.optimizeStream({
    space,
    sampler: Sampler.tpe({ seed: 99 }),
    objective,
    direction: "minimize",
    trials: 12
  }).pipe(
    Progress.tap(),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  const optimizeCompleted = Arr.length(Arr.filter(optimizeEvents, (event) => event._tag === "TrialCompleted"))
  const optimizeBestUpdates = Arr.length(Arr.filter(optimizeEvents, (event) => event._tag === "BestUpdated"))

  yield* Effect.log("Preparing snapshot for resumeStream terminal progress demo")

  const baseline = yield* Study.minimize({
    space,
    sampler: Sampler.random({ seed: 90210 }),
    objective,
    trials: 6
  })
  const snapshot = yield* Study.snapshot(baseline)

  const resumeEvents = yield* Study.resumeStream({
    space,
    sampler: Sampler.random({ seed: 90210 }),
    snapshot,
    direction: "minimize",
    trials: 4,
    objective
  }).pipe(
    Progress.tap(),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  const resumeCompleted = Arr.length(Arr.filter(resumeEvents, (event) => event._tag === "TrialCompleted"))
  const resumeLastEvent = Option.match(Arr.last(resumeEvents), {
    onNone: () => "none",
    onSome: (event) => event._tag
  })

  yield* Effect.log("Summary", {
    optimizeCompleted,
    optimizeBestUpdates,
    optimizeTotalEvents: Arr.length(optimizeEvents),
    resumeCompleted,
    resumeTotalEvents: Arr.length(resumeEvents),
    resumeLastEvent
  })
})

BunRuntime.runMain(program)
