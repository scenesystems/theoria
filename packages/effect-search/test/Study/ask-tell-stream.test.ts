import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Match, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Study ask-tell stream", () => {
  it.effect("streams ask/tell events and completes stream on cancel", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 444 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const eventsFiber = yield* Study.events(handle).pipe(Stream.runCollect, Effect.fork)
        yield* Effect.yieldNow()

        const reserved = yield* Study.ask(handle)
        yield* Study.tell(handle, reserved.trialNumber, reserved.config.x + reserved.config.depth)
        yield* Study.cancel(handle)

        const eventsOption = yield* Fiber.join(eventsFiber).pipe(Effect.timeoutOption("1 second"))
        expect(Option.isSome(eventsOption)).toBe(true)

        if (Option.isNone(eventsOption)) {
          return
        }

        const tags = Chunk.toReadonlyArray(eventsOption.value).map((event) => event._tag)
        expect(tags).toContain("TrialStarted")
        expect(tags).toContain("TrialCompleted")
        expect(tags).toContain("StudyCompleted")

        const completedReason = Chunk.toReadonlyArray(eventsOption.value).flatMap((event) =>
          Match.value(event).pipe(
            Match.tag("StudyCompleted", ({ completionReason }) => [completionReason]),
            Match.orElse(() => [])
          )
        )

        expect(completedReason).toEqual(["interrupted"])
      })
    ))
})
