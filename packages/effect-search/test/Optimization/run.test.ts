import * as KeyValueStore from "@effect/platform/KeyValueStore"
import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Chunk,
  Effect,
  Either,
  Layer,
  Match,
  Number as Num,
  Option,
  Predicate,
  Schedule,
  Stream,
  Tuple
} from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Cache from "../../src/Cache.js"
import type { Direction } from "../../src/Direction.js"
import * as ObjectiveCache from "../../src/ObjectiveCache.js"
import * as Optimization from "../../src/Optimization.js"
import * as OptimizationEvent from "../../src/OptimizationEvent.js"
import * as Sampler from "../../src/Sampler.js"
import { NoSuccessfulTrials, TrialError } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Trial from "../../src/Trial.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(Arr.make("adam", "sgd"))
  })

const completedValues = (trials: Iterable<Trial.Trial<unknown>>) =>
  Arr.flatMap(Arr.fromIterable(trials), (trial) =>
    Trial.matchState({
      Running: Arr.empty,
      Completed: ({ value }) =>
        Option.liftPredicate(value, Predicate.isNumber).pipe(
          Option.match({
            onNone: Arr.empty,
            onSome: Arr.of
          })
        ),
      Pruned: Arr.empty,
      Failed: Arr.empty,
      Cancelled: Arr.empty
    })(trial.state))

const failedCount = (trials: Iterable<Trial.Trial<unknown>>) =>
  Arr.length(Arr.filter(trials, (trial) => Trial.isState("Failed")(trial.state)))

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization.run", () => {
  it.effect("supports the full trial state lifecycle", () =>
    Effect.sync(() => {
      const running = Trial.makeRunning(7, { seed: 1 }, 100)
      const completed = Trial.complete(running, 2.5, 115)
      const failed = Trial.fail(
        running,
        new TrialError({
          trialNumber: 7,
          message: "objective failed",
          cause: new NoSuccessfulTrials({ trialCount: 1 })
        }),
        130
      )
      const cancelled = Trial.cancel(running)

      expect(Trial.isState("Running")(running.state)).toBe(true)
      expect(Trial.isState("Completed")(completed.state)).toBe(true)
      expect(Trial.isState("Failed")(failed.state)).toBe(true)
      expect(Trial.isState("Cancelled")(cancelled.state)).toBe(true)

      Trial.matchState({
        Completed: (state) => {
          expect(state.value).toBe(2.5)
          expect(state.duration).toBe(15)
        },
        Running: () => undefined,
        Pruned: () => undefined,
        Failed: () => undefined,
        Cancelled: () => undefined
      })(completed.state)
      Trial.matchState({
        Failed: (state) => {
          expect(state.duration).toBe(30)
          expect(state.error).toBeInstanceOf(TrialError)
          expect(state.error.cause).toBeInstanceOf(NoSuccessfulTrials)
        },
        Running: () => undefined,
        Completed: () => undefined,
        Pruned: () => undefined,
        Cancelled: () => undefined
      })(failed.state)
    }))

  it.effect("runs with random sampling and returns a single-objective result", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 21 }),
        direction: "minimize",
        trials: 12,
        objective: (raw) => {
          const config = raw
          const optimizerPenalty = Match.value(config.optimizer).pipe(
            Match.when("adam", () => 0),
            Match.orElse(() => 0.25)
          )
          const score = Num.sumAll(Arr.make(Numeric.abs(config.x), config.depth, optimizerPenalty))
          return Effect.succeed(score)
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      expect(result._tag).toBe("SingleObjective")
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(12)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11
      ))

      const values = completedValues(result.trials)
      expect(Arr.length(values)).toBeGreaterThan(0)

      const baseline = Arr.head(values).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const minimum = Arr.reduce(values, baseline, Num.min)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("honors optimization direction for minimize and maximize", () =>
    Effect.gen(function*() {
      const minimizeOptimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 55 }),
        direction: "minimize",
        trials: 15,
        objective: (raw) => {
          const config = raw
          return Effect.succeed(config.x)
        }
      })

      const maximizeOptimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 55 }),
        direction: "maximize",
        trials: 15,
        objective: (raw) => {
          const config = raw
          return Effect.succeed(config.x)
        }
      })

      const minimizeResultOption = asSingleObjective(minimizeOptimized)
      const maximizeResultOption = asSingleObjective(maximizeOptimized)
      expect(Option.isSome(minimizeResultOption)).toBe(true)
      expect(Option.isSome(maximizeResultOption)).toBe(true)
      const minimizeResult = yield* minimizeResultOption
      const maximizeResult = yield* maximizeResultOption
      const minimizeValues = completedValues(minimizeResult.trials)
      const maximizeValues = completedValues(maximizeResult.trials)
      const minBaseline = Arr.head(minimizeValues).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))
      const maxBaseline = Arr.head(maximizeValues).pipe(Option.getOrElse(() => Number.NEGATIVE_INFINITY))
      const minValue = Arr.reduce(minimizeValues, minBaseline, Num.min)
      const maxValue = Arr.reduce(maximizeValues, maxBaseline, Num.max)

      expect(minimizeResult.bestTrial.state.value).toBe(minValue)
      expect(maximizeResult.bestTrial.state.value).toBe(maxValue)
      expect(minimizeResult.bestTrial.state.value).toBeLessThanOrEqual(maximizeResult.bestTrial.state.value)
    }))

  it.effect("marks NaN objective values as failed while continuing the optimization", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 77 }),
        direction: "minimize",
        trials: 20,
        objective: (raw) => {
          const config = raw
          return Effect.succeed(
            Match.value(Num.greaterThan(config.x, 0)).pipe(
              Match.when(true, () => Number.NaN),
              Match.orElse(() => Numeric.abs(config.x))
            )
          )
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      expect(failedCount(result.trials)).toBeGreaterThan(0)
      expect(Arr.length(completedValues(result.trials))).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
    }))

  it.effect("marks Infinity objective values as failed while continuing the optimization", () =>
    Effect.gen(function*() {
      const optimized = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 88 }),
        direction: "minimize",
        trials: 20,
        objective: (raw) => {
          const config = raw
          return Effect.succeed(
            Match.value(Num.greaterThan(config.x, 0)).pipe(
              Match.when(true, () => Number.POSITIVE_INFINITY),
              Match.orElse(() => Numeric.abs(config.x))
            )
          )
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)
      const result = yield* resultOption
      expect(failedCount(result.trials)).toBeGreaterThan(0)
      expect(Arr.length(completedValues(result.trials))).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
    }))

  it.effect("fails with NoSuccessfulTrials when every trial is invalid", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Optimization.run({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 13 }),
          direction: "minimize",
          trials: 8,
          objective: () => Effect.succeed(Number.NaN)
        })
      )

      expect(Either.getOrThrow(Either.flip(outcome))).toBeInstanceOf(NoSuccessfulTrials)
    }))

  it.effect("maps cache corruption failures into trial failures in run path", () =>
    Effect.gen(function*() {
      const corruption = new Cache.Corrupt({
        key: "optimization:corrupt-run-path",
        reason: "forced-corruption"
      })

      const failingCacheLayer = Layer.scoped(
        Cache.Cache,
        Cache.make().pipe(
          Effect.map((cache) => ({
            ...cache,
            resolve: () => Effect.fail(corruption)
          }))
        )
      ).pipe(Layer.provide(KeyValueStore.layerMemory))

      const objectiveCacheLayer = Layer.effect(
        ObjectiveCache.ObjectiveCache,
        ObjectiveCache.make(new ObjectiveCache.Options({ scope: "optimization-cache-corrupt" }))
      ).pipe(Layer.provide(failingCacheLayer))

      const result = yield* Stream.runCollect(
        Optimization.stream({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 21 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(0),
          objective: (raw) => {
            const config = raw
            return Effect.succeed(Num.sum(Numeric.abs(config.x), config.depth))
          }
        }).pipe(
          Stream.provideLayer(objectiveCacheLayer)
        )
      )

      const events = Chunk.toReadonlyArray(result)
      const failedTrialEvent = yield* Arr.findFirst(events, OptimizationEvent.is("TrialFailed"))

      expect(failedTrialEvent._tag).toBe("TrialFailed")
      expect(failedTrialEvent.error).toBeInstanceOf(TrialError)
      expect(failedTrialEvent.error.cause).toEqual(corruption)
      expect(failedTrialEvent.error.message).toBe("objective cache failure: effect-search/CacheCorrupt")
    }))

  it.effect("maps cache backend failures into trial failures in run path", () =>
    Effect.gen(function*() {
      const backendFailure = new Cache.BackendError({
        operation: "get",
        reason: "forced-backend-failure"
      })

      const failingCacheLayer = Layer.scoped(
        Cache.Cache,
        Cache.make().pipe(
          Effect.map((cache) => ({
            ...cache,
            resolve: () => Effect.fail(backendFailure)
          }))
        )
      ).pipe(Layer.provide(KeyValueStore.layerMemory))

      const objectiveCacheLayer = Layer.effect(
        ObjectiveCache.ObjectiveCache,
        ObjectiveCache.make(new ObjectiveCache.Options({ scope: "optimization-cache-backend" }))
      ).pipe(Layer.provide(failingCacheLayer))

      const result = yield* Stream.runCollect(
        Optimization.stream({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 21 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(0),
          objective: (raw) => {
            const config = raw
            return Effect.succeed(Num.sum(Numeric.abs(config.x), config.depth))
          }
        }).pipe(
          Stream.provideLayer(objectiveCacheLayer)
        )
      )

      const events = Chunk.toReadonlyArray(result)
      const failedTrialEvent = yield* Arr.findFirst(events, OptimizationEvent.is("TrialFailed"))

      expect(failedTrialEvent._tag).toBe("TrialFailed")
      expect(failedTrialEvent.error).toBeInstanceOf(TrialError)
      expect(failedTrialEvent.error.cause).toEqual(backendFailure)
      expect(failedTrialEvent.error.message).toBe("objective cache failure: effect-search/CacheBackendError")
    }))

  it.effect("rejects unsafe counts and objective-specific stopping options", () =>
    Effect.gen(function*() {
      const base = {
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 22 }),
        objective: () => Effect.succeed(0)
      }
      const results = yield* Effect.all(Tuple.make(
        Effect.either(Optimization.run({ ...base, direction: "minimize", trials: 1.5 })),
        Effect.either(Optimization.run({ ...base, direction: "minimize", trials: 1, concurrency: 1.5 })),
        Effect.either(Optimization.run({
          ...base,
          directions: Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "maximize"),
          trials: 1,
          targetValue: 0
        })),
        Effect.either(Optimization.run({ ...base, direction: "minimize", trials: 1, epsilon: 0.1 }))
      ))

      Arr.forEach(results, (result) => {
        expect(Either.isLeft(result)).toBe(true)
        expect(Either.getOrThrow(Either.flip(result))._tag).toBe("effect-search/InvalidOptimizationConfig")
      })
    }))
})
