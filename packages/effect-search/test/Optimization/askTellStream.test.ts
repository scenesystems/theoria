import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Fiber, Match, Number as Num, Option, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Optimization ask-tell stream", () => {
  it.effect("streams ask/tell events and completes stream on cancel", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 444 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const eventsFiber = yield* Optimization.events(handle).pipe(Stream.runCollect, Effect.fork)
        yield* Effect.yieldNow()

        const reserved = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, reserved.trialNumber, Num.sum(reserved.config.x, reserved.config.depth))
        yield* Optimization.cancel(handle)

        const eventsOption = yield* Fiber.join(eventsFiber).pipe(Effect.timeoutOption("1 second"))
        expect(Option.isSome(eventsOption)).toBe(true)
        const events = yield* eventsOption

        const tags = Arr.map(Chunk.toReadonlyArray(events), (event) => event._tag)
        expect(tags).toContain("TrialStarted")
        expect(tags).toContain("TrialCompleted")
        expect(tags).toContain("Completed")

        const completedReason = Arr.flatMap(Chunk.toReadonlyArray(events), (event) =>
          Match.value(event).pipe(
            Match.tag("Completed", ({ completionReason }) => Arr.of(completionReason)),
            Match.orElse(Arr.empty)
          ))

        expect(completedReason).toEqual(Arr.of("interrupted"))
      })
    ))
})
