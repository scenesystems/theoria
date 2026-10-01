import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Equal, Match, Number as Num, Option, Predicate, Schedule, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig, NoSuccessfulTrials } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(Arr.make("adam", "sgd"))
  })

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const completedValues = (result: Optimization.SingleObjectiveResult) =>
  Arr.flatMap(
    Arr.fromIterable(result.trials),
    (trial) =>
      Match.value(trial.state).pipe(
        Match.tag("Completed", ({ value }) => Option.liftPredicate(value, Predicate.isNumber).pipe(Option.toArray)),
        Match.orElse(() => Arr.empty<number>())
      )
  )

describe("Optimization.run regression edge cases", () => {
  it.effect("rejects an unsafe integer trial budget", () =>
    Effect.gen(function*() {
      const outcome = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 300 }),
        direction: "minimize",
        trials: 9_007_199_254_740_992,
        objective: () => Effect.succeed(0)
      }).pipe(Effect.either)

      const failure = yield* Schema.decodeUnknown(InvalidOptimizationConfig)(
        Either.getOrThrow(Either.flip(outcome))
      )
      expect(failure.reason).toContain("trials to be an integer")
    }))

  it.effect("fails with NoSuccessfulTrials when trials is zero", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const outcome = yield* Effect.either(
        Optimization.run({
          space,
          sampler: Sampler.random({ seed: 301 }),
          direction: "minimize",
          trials: 0,
          objective: () => Effect.succeed(0)
        })
      )

      const failure = yield* Schema.decodeUnknown(NoSuccessfulTrials)(Either.getOrThrow(Either.flip(outcome)))
      expect(failure).toBeInstanceOf(NoSuccessfulTrials)
      expect(failure._tag).toBe("effect-search/NoSuccessfulTrials")
      expect(failure.trialCount).toBe(0)
    }))

  it.effect("returns a deterministic single-trial result when trials is one", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 302 }),
        direction: "minimize",
        trials: 1,
        objective: (raw) => {
          const config = raw
          return Effect.succeed(Num.sum(Numeric.abs(config.x), config.depth))
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      expect(result.trials).toHaveLength(1)
      expect(Option.map(Arr.head(Arr.fromIterable(result.trials)), (trial) => trial.trialNumber)).toEqual(
        Option.some(0)
      )
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.bestTrial.trialNumber).toBe(0)
      expect(result.bestTrial.state.value).toBe(Option.getOrThrow(Arr.head(completedValues(result))))
    }))

  it.effect("keeps first completed trial as best when all objective values are identical", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 303 }),
        direction: "minimize",
        trials: 12,
        objective: () => Effect.succeed(7.5)
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      const values = completedValues(result)
      const baseline = Arr.head(values).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const minimum = Arr.reduce(values, baseline, Num.min)

      expect(values).toHaveLength(12)
      expect(Arr.every(values, Equal.equals(7.5))).toBe(true)
      expect(result.bestTrial.trialNumber).toBe(0)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("fails with NoSuccessfulTrials when every trial fails via objective error channel", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const outcome = yield* Effect.either(
        Optimization.run({
          space,
          sampler: Sampler.random({ seed: 304 }),
          direction: "minimize",
          trials: 6,
          retrySchedule: Schedule.recurs(0),
          objective: () => Effect.fail("objective-failure")
        })
      )

      const failure = yield* Schema.decodeUnknown(NoSuccessfulTrials)(Either.getOrThrow(Either.flip(outcome)))
      expect(failure).toBeInstanceOf(NoSuccessfulTrials)
      expect(failure._tag).toBe("effect-search/NoSuccessfulTrials")
      expect(failure.trialCount).toBe(6)
    }))
})
