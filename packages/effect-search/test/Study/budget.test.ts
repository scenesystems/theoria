import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Number as Num, Predicate, Schedule, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1)
  })

describe("budget-aware stopping", () => {
  it.effect("tracks trial costs and stops with budgetExhausted when cumulative cost exceeds maxCost", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* makeSpace(),
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
      expect(Arr.length(result.trials)).toBe(2)
      expect(Arr.map(result.trials, (trial) => trial.cost)).toEqual(Arr.make(3, 3))
    }))

  it.effect("emits TrialCosted events with cumulative totals", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
          space: yield* makeSpace(),
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

      const costed = Chunk.filter(events, (event) => Predicate.isTagged(event, "TrialCosted"))
      const completed = Chunk.filter(events, (event) => Predicate.isTagged(event, "StudyCompleted"))

      expect(Chunk.toReadonlyArray(Chunk.map(costed, (event) => event.cumulativeCost))).toEqual(Arr.make(3, 6))
      expect(Chunk.size(completed)).toBe(1)
      expect((yield* Chunk.head(completed)).completionReason).toBe("budgetExhausted")
    }))

  it.effect("keeps trial-budget completion semantics when objectives return only values", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 44 }),
        direction: "minimize",
        trials: 3,
        maxCost: 1,
        objective: () => Effect.succeed(0.5)
      })

      expect(result.completionReason).toBe("budgetExhausted")
      expect(Arr.length(result.trials)).toBe(3)
    }))

  it.effect.each(Arr.make(-0.5, Num.unsafeDivide(1, 0), Num.unsafeDivide(0, 0)))(
    "rejects invalid reported cost %s instead of completing the trial",
    (cost) =>
      Effect.gen(function*() {
        const error = yield* Study.optimize({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 44 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(0),
          objective: () => Effect.succeed(new Study.ObjectiveReport({ value: 0.5, cost }))
        }).pipe(Effect.flip)

        expect(error).toMatchObject({ _tag: "effect-search/NoSuccessfulTrials", trialCount: 1 })
      })
  )

  it.effect("preserves an explicitly reported zero cost", () =>
    Effect.gen(function*() {
      const result = yield* Study.optimize({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 44 }),
        direction: "minimize",
        trials: 1,
        objective: () => Effect.succeed(new Study.ObjectiveReport({ value: 0.5, cost: 0 }))
      })

      expect(Arr.map(result.trials, (trial) => trial.state._tag)).toEqual(Arr.of("Completed"))
      expect((yield* Arr.head(result.trials)).cost).toBe(0)
    }))
})
