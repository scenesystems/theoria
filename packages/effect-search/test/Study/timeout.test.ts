import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Ref, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study objective timeout", () => {
  it.live("cancels timed-out trials and emits TrialCancelled events", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 17 }),
          direction: "minimize",
          trials: 1,
          trialTimeout: "10 millis",
          objective: () => Effect.sleep("50 millis").pipe(Effect.as(0.25))
        })
      )
      const eventList = Chunk.toReadonlyArray(events)
      const tags = eventList.map((event) => event._tag)
      const cancelledReasons = eventList.flatMap((event) =>
        event._tag === "TrialCancelled"
          ? [event.reason]
          : []
      )

      expect(tags).toContain("TrialCancelled")
      expect(tags).not.toContain("TrialFailed")
      expect(cancelledReasons).toEqual(["timeout"])
    }))

  it.live("interrupts objective fibers and runs cleanup finalizers on timeout", () =>
    Effect.gen(function*() {
      const interruptedRef = yield* Ref.make(false)

      yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 23 }),
          direction: "minimize",
          trials: 1,
          trialTimeout: "10 millis",
          objective: () =>
            Effect.never.pipe(
              Effect.ensuring(Ref.set(interruptedRef, true)),
              Effect.as(0.25)
            )
        })
      )

      expect(yield* Ref.get(interruptedRef)).toBe(true)
    }))
})
