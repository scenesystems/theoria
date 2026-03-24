import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("budget-aware stopping", () => {
  it.effect("tracks trial costs and stops with budgetExhausted when cumulative cost exceeds maxCost", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 13 }),
        direction: "minimize",
        trials: 10,
        concurrency: 1,
        maxCost: 5,
        objective: () =>
          Effect.succeed({
            value: 0.5,
            cost: 3
          })
      })

      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials.length).toBe(2)
      expect(result.trials.map((trial) => trial.cost)).toEqual([3, 3])
    }))

  it.effect("emits TrialCosted events with cumulative totals", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 13 }),
          direction: "minimize",
          trials: 10,
          concurrency: 1,
          maxCost: 5,
          objective: () =>
            Effect.succeed({
              value: 0.5,
              cost: 3
            })
        })
      )

      const eventList = Chunk.toReadonlyArray(events)
      const costed = eventList.flatMap((event) => event._tag === "TrialCosted" ? [event] : [])
      const completed = eventList.filter((event) => event._tag === "StudyCompleted")

      expect(costed.map((event) => event.cumulativeCost)).toEqual([3, 6])
      expect(completed).toHaveLength(1)
      expect(completed[0]?.completionReason).toBe("budgetExhausted")
    }))

  it.effect("keeps trial-budget completion semantics when objectives return only values", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 44 }),
        direction: "minimize",
        trials: 3,
        maxCost: 1,
        objective: () => Effect.succeed(0.5)
      })

      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials.length).toBe(3)
    }))
})
