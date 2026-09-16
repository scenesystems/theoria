/**
 * Resumes from a snapshot and consumes the optimization's lifecycle events as
 * a stream.
 *
 * Run: bun run examples/13-resume-stream.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Chunk, Effect, Number as Num, Option, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationEvent, Sampler, SearchSpace } from "@scenesystems/effect-search"

const objectiveValue = (x: number, depth: number): number =>
  Num.sum(Numeric.abs(Num.subtract(x, 0.35)), Num.multiply(depth, 0.05))

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 4)
  })
  const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.depth))

  const baseline = yield* Optimization.minimize({
    space,
    sampler: Sampler.random({ seed: 813 }),
    trials: 6,
    objective
  })
  const snapshot = yield* Optimization.snapshot(baseline)

  const events = yield* Optimization.resumeStream({
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

  const optimizationCompletedEvents = Arr.filter(events, OptimizationEvent.is("Completed"))

  yield* Effect.log("Resume stream complete", {
    resumedFromTrial: snapshot.nextTrialNumber,
    emittedEvents: Arr.length(events),
    optimizationCompletedEvents: Arr.length(optimizationCompletedEvents),
    lastEvent: Option.match(Arr.last(events), {
      onNone: () => "none",
      onSome: (event) => event._tag
    })
  })
})

BunRuntime.runMain(program)
