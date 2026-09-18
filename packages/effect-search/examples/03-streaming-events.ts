/**
 * Renders terminal progress for a new optimization and a resumed optimization while
 * collecting the unchanged event streams for inspection.
 *
 * Run: bun run examples/03-streaming-events.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationEvent, Progress, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-10, 10),
    y: SearchSpace.float(-10, 10)
  })
  const objective = (config: SearchSpace.Type<typeof space>) =>
    Effect.succeed(
      Num.sumAll(Arr.make(
        Num.multiply(Numeric.sin(config.x), Numeric.cos(config.y)),
        Numeric.pow(Num.subtract(config.x, 1), 2),
        Numeric.pow(Num.sum(config.y, 2), 2)
      ))
    )

  yield* Effect.log("Starting stream run with terminal progress")

  const optimizeEvents = yield* Optimization.stream({
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

  const optimizeCompleted = Arr.length(Arr.filter(optimizeEvents, OptimizationEvent.is("TrialCompleted")))
  const optimizeBestUpdates = Arr.length(Arr.filter(optimizeEvents, OptimizationEvent.is("BestUpdated")))

  yield* Effect.log("Preparing snapshot for resumeStream terminal progress demo")

  const baseline = yield* Optimization.minimize({
    space,
    sampler: Sampler.random({ seed: 90210 }),
    objective,
    trials: 6
  })
  const snapshot = yield* Optimization.snapshot(baseline)

  const resumeEvents = yield* Optimization.resumeStream({
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

  const resumeCompleted = Arr.length(Arr.filter(resumeEvents, OptimizationEvent.is("TrialCompleted")))
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
