import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Study.optimizeStream", () => {
  it.effect("emits lifecycle events in target-state order and closes with StudyCompleted", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const collected = yield* Stream.runCollect(
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 9 }),
          direction: "minimize",
          trials: 4,
          objective: (raw) => {
            const config = raw
            return Effect.succeed(config.x + config.depth)
          }
        })
      )

      const events = Chunk.toReadonlyArray(collected)
      const tags = events.map((event) => event._tag)

      expect(tags.filter((tag) => tag === "TrialStarted")).toHaveLength(4)
      expect(tags.filter((tag) => tag === "TrialCompleted")).toHaveLength(4)
      expect(tags).toContain("BestUpdated")
      expect(tags[tags.length - 1]).toBe("StudyCompleted")
    }))

  it.live("emits incrementally before the full study completes", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const firstEvent = yield* Stream.runHead(
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 13 }),
          direction: "minimize",
          trials: 50,
          objective: (raw) => {
            const config = raw

            return Effect.sleep("10 millis").pipe(Effect.as(config.x + config.depth))
          }
        })
      ).pipe(
        Effect.timeoutOption("30 millis")
      )
      const firstObserved = Option.flatten(firstEvent)

      expect(Option.isSome(firstObserved)).toBe(true)

      if (Option.isSome(firstObserved)) {
        expect(firstObserved.value._tag).toBe("TrialStarted")
      }
    }))

  it.live("can be interrupted via Effect.timeout", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const timed = yield* Stream.runDrain(
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 33 }),
          direction: "minimize",
          trials: 100,
          objective: (config) => Effect.sleep("20 millis").pipe(Effect.as(config.x + config.depth))
        })
      ).pipe(Effect.timeoutOption("40 millis"))

      expect(Option.isNone(timed)).toBe(true)
    }))
})
