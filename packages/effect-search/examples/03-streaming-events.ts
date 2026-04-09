/**
 * Streaming Events — monitor optimization progress in real time.
 *
 * Uses `Study.TerminalReporter.tap` to render a first-party terminal view while
 * preserving the original event stream contracts.
 *
 * What this shows: optional terminal reporting that composes with
 * both Study.optimizeStream and Study.resumeStream without changing
 * optimization behavior.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/03-streaming-events.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Effect, Stream } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-10, 10),
    y: SearchSpace.float(-10, 10)
  })
  const objective = (config: SearchSpace.Type<typeof space>) =>
    Effect.succeed(
      Math.sin(config.x) * Math.cos(config.y) + (config.x - 1) ** 2 + (config.y + 2) ** 2
    )

  yield* Effect.log("Starting optimizeStream run with terminal progress")

  const optimizeEvents = yield* Study.optimizeStream({
    space,
    sampler: Sampler.tpe({ seed: 99 }),
    objective,
    direction: "minimize",
    trials: 12
  }).pipe(
    Study.TerminalReporter.tap(),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  const optimizeCompleted = optimizeEvents.filter((event) => event._tag === "TrialCompleted").length
  const optimizeBestUpdates = optimizeEvents.filter((event) => event._tag === "BestUpdated").length

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
    Study.TerminalReporter.tap(),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

  const resumeCompleted = resumeEvents.filter((event) => event._tag === "TrialCompleted").length
  const resumeLastEvent = resumeEvents[resumeEvents.length - 1]?._tag ?? "none"

  yield* Effect.log("Summary", {
    optimizeCompleted,
    optimizeBestUpdates,
    optimizeTotalEvents: optimizeEvents.length,
    resumeCompleted,
    resumeTotalEvents: resumeEvents.length,
    resumeLastEvent
  })
})

BunRuntime.runMain(program)
