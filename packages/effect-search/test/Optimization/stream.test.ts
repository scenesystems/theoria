import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Number as Num, Option, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.multiply(-1, 1), 1),
    depth: SearchSpace.int(1, 3)
  })

describe("Optimization.stream", () => {
  it.effect("emits lifecycle events in target-state order and closes with Completed", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const collected = yield* Stream.runCollect(
        Optimization.stream(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.random({ seed: 9 }),
            direction: "minimize",
            trials: 4,
            objective: (raw) => {
              const config = raw
              return Effect.succeed(Num.sum(config.x, config.depth))
            }
          })
        )
      )

      const events = collected
      const tags = Arr.map(events, (event) => event._tag)

      expect(Arr.filter(tags, Equal.equals("TrialStarted"))).toHaveLength(4)
      expect(Arr.filter(tags, Equal.equals("TrialCompleted"))).toHaveLength(4)
      expect(tags).toContain("BestUpdated")
      expect(Arr.last(tags)).toEqual(Option.some("Completed"))
    }))

  it.live("emits incrementally before the full optimization completes", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const firstEvent = yield* Stream.runHead(
        Optimization.stream(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.random({ seed: 13 }),
            direction: "minimize",
            trials: 50,
            objective: (raw) => {
              const config = raw

              return Effect.sleep("10 millis").pipe(Effect.as(Num.sum(config.x, config.depth)))
            }
          })
        )
      ).pipe(
        Effect.timeoutOption("30 millis")
      )
      const firstObserved = Option.flatten(firstEvent)

      expect(Option.isSome(firstObserved)).toBe(true)
      expect((yield* Effect.fromOption(firstObserved))._tag).toBe("TrialStarted")
    }))

  it.live("can be interrupted via Effect.timeout", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const timed = yield* Stream.runDrain(
        Optimization.stream(
          new Optimization.FlatOptions({
            space,
            sampler: Sampler.random({ seed: 33 }),
            direction: "minimize",
            trials: 100,
            objective: (config) => Effect.sleep("20 millis").pipe(Effect.as(Num.sum(config.x, config.depth)))
          })
        )
      ).pipe(Effect.timeoutOption("40 millis"))

      expect(Option.isNone(timed)).toBe(true)
    }))
})
