import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Predicate, Schedule, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.multiply(-1, 1), 1)
  })

describe("budget-aware stopping", () => {
  it.effect("tracks trial costs and stops with budgetExhausted when cumulative cost exceeds maxCost", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
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

      expect(result.completionReason).toBe("budgetExhausted")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBe(2)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.cost)).toEqual(Arr.make(3, 3))
    }))

  it.effect("emits TrialCosted events with cumulative totals", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Optimization.stream(
          new Optimization.FlatOptions({
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
      )

      const costed = Arr.filter(events, (event) => Predicate.isTagged(event, "TrialCosted"))
      const completed = Arr.filter(events, (event) => Predicate.isTagged(event, "Completed"))

      expect(Arr.map(costed, (event) => event.cumulativeCost)).toEqual(Arr.make(3, 6))
      expect(Arr.length(completed)).toBe(1)
      expect((yield* Effect.fromOption(Arr.head(completed))).completionReason).toBe("budgetExhausted")
    }))

  it.effect("keeps trial-budget completion semantics when objectives return only values", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 44 }),
          direction: "minimize",
          trials: 3,
          maxCost: 1,
          objective: () => Effect.succeed(0.5)
        })
      )

      expect(result.completionReason).toBe("budgetExhausted")
      expect(Arr.length(Arr.fromIterable(result.trials))).toBe(3)
    }))

  it.effect.each(Arr.make(Num.multiply(-1, 0.5), Number.POSITIVE_INFINITY, Number.NaN))(
    "rejects invalid reported cost %s instead of completing the trial",
    (cost) =>
      Effect.gen(function*() {
        const error = yield* Optimization.run(
          new Optimization.FlatOptions({
            space: yield* makeSpace(),
            sampler: Sampler.random({ seed: 44 }),
            direction: "minimize",
            trials: 1,
            retrySchedule: Schedule.recurs(0),
            objective: () => Effect.succeed(new Optimization.ObjectiveReport({ value: 0.5, cost }))
          })
        ).pipe(Effect.flip)

        expect(error).toMatchObject({ _tag: "effect-search/NoSuccessfulTrials", trialCount: 1 })
      })
  )

  it.effect("preserves an explicitly reported zero cost", () =>
    Effect.gen(function*() {
      const result = yield* Optimization.run(
        new Optimization.FlatOptions({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 44 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(new Optimization.ObjectiveReport({ value: 0.5, cost: 0 }))
        })
      )

      const trials = Arr.fromIterable(result.trials)
      expect(Arr.map(trials, (trial) => trial.state._tag)).toEqual(Arr.of("Completed"))
      expect((yield* Effect.fromOption(Arr.head(trials))).cost).toBe(0)
    }))
})
