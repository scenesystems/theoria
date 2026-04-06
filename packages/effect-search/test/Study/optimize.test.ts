import * as KeyValueStore from "@effect/platform/KeyValueStore"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Either, Layer, Number as Num, Option, Schedule, Schema, Stream } from "effect"
import { abs } from "effect-math/Numeric"

import * as Cache from "../../src/Cache/index.js"
import { NoSuccessfulTrials, TrialError } from "../../src/Errors/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"
import * as Trial from "../../src/Trial/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2),
    depth: SearchSpace.int(1, 5),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

const decodeObjectiveConfig = Schema.decodeUnknownSync(makeSpace().schema)

const completedValues = (trials: Array<Trial.Trial<unknown>>): Array<number> =>
  trials.flatMap((trial) =>
    Trial.matchState({
      Running: () => [],
      Completed: ({ value }) =>
        Option.fromNullable(typeof value === "number" ? value : undefined).pipe(
          Option.match({
            onNone: () => [],
            onSome: (numericValue) => [numericValue]
          })
        ),
      Pruned: () => [],
      Failed: () => [],
      Cancelled: () => []
    })(trial.state)
  )

const failedCount = (trials: Array<Trial.Trial<unknown>>) =>
  trials.filter((trial) => Trial.isState("Failed")(trial.state)).length

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

describe("Study.optimize", () => {
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

      if (Trial.isState("Completed")(completed.state)) {
        expect(completed.state.value).toBe(2.5)
        expect(completed.state.duration).toBe(15)
      }

      if (Trial.isState("Failed")(failed.state)) {
        expect(failed.state.duration).toBe(30)
        expect(failed.state.error).toBeInstanceOf(TrialError)
        expect(failed.state.error.cause).toBeInstanceOf(NoSuccessfulTrials)
      }
    }))

  it.effect("optimizes with random sampling and returns a single-objective result", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 21 }),
        direction: "minimize",
        trials: 12,
        objective: (raw) => {
          const config = decodeObjectiveConfig(raw)
          const optimizerPenalty = config.optimizer === "adam" ? 0 : 0.25
          const score = abs(config.x) + config.depth + optimizerPenalty
          return Effect.succeed(score)
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      expect(result._tag).toBe("SingleObjective")
      expect(result.completionReason).toBe("budgetExhausted")
      expect(result.trials).toHaveLength(12)
      expect(result.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])

      const values = completedValues(result.trials)
      expect(values.length).toBeGreaterThan(0)

      const baseline = values[0] ?? Number.POSITIVE_INFINITY
      const minimum = values.reduce((best, value) => Num.min(best, value), baseline)
      expect(result.bestTrial.state.value).toBe(minimum)
    }))

  it.effect("honors optimization direction for minimize and maximize", () =>
    Effect.gen(function*() {
      const minimizeOptimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 55 }),
        direction: "minimize",
        trials: 15,
        objective: (raw) => {
          const config = decodeObjectiveConfig(raw)
          return Effect.succeed(config.x)
        }
      })

      const maximizeOptimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 55 }),
        direction: "maximize",
        trials: 15,
        objective: (raw) => {
          const config = decodeObjectiveConfig(raw)
          return Effect.succeed(config.x)
        }
      })

      const minimizeResultOption = asSingleObjective(minimizeOptimized)
      const maximizeResultOption = asSingleObjective(maximizeOptimized)
      expect(Option.isSome(minimizeResultOption)).toBe(true)
      expect(Option.isSome(maximizeResultOption)).toBe(true)

      if (Option.isNone(minimizeResultOption) || Option.isNone(maximizeResultOption)) {
        return
      }

      const minimizeResult = minimizeResultOption.value
      const maximizeResult = maximizeResultOption.value
      const minimizeValues = completedValues(minimizeResult.trials)
      const maximizeValues = completedValues(maximizeResult.trials)
      const minBaseline = minimizeValues[0] ?? Number.POSITIVE_INFINITY
      const maxBaseline = maximizeValues[0] ?? Number.NEGATIVE_INFINITY
      const minValue = minimizeValues.reduce((best, value) => Num.min(best, value), minBaseline)
      const maxValue = maximizeValues.reduce((best, value) => Num.max(best, value), maxBaseline)

      expect(minimizeResult.bestTrial.state.value).toBe(minValue)
      expect(maximizeResult.bestTrial.state.value).toBe(maxValue)
      expect(minimizeResult.bestTrial.state.value).toBeLessThanOrEqual(maximizeResult.bestTrial.state.value)
    }))

  it.effect("marks NaN objective values as failed while continuing the study", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 77 }),
        direction: "minimize",
        trials: 20,
        objective: (raw) => {
          const config = decodeObjectiveConfig(raw)
          return Effect.succeed(config.x > 0 ? Number.NaN : abs(config.x))
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      expect(failedCount(result.trials)).toBeGreaterThan(0)
      expect(completedValues(result.trials).length).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
    }))

  it.effect("marks Infinity objective values as failed while continuing the study", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 88 }),
        direction: "minimize",
        trials: 20,
        objective: (raw) => {
          const config = decodeObjectiveConfig(raw)
          return Effect.succeed(config.x > 0 ? Number.POSITIVE_INFINITY : abs(config.x))
        }
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      expect(failedCount(result.trials)).toBeGreaterThan(0)
      expect(completedValues(result.trials).length).toBeGreaterThan(0)
      expect(Trial.isState("Completed")(result.bestTrial.state)).toBe(true)
    }))

  it.effect("fails with NoSuccessfulTrials when every trial is invalid", () =>
    Effect.gen(function*() {
      const outcome = yield* Effect.either(
        Study.optimize({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 13 }),
          direction: "minimize",
          trials: 8,
          objective: () => Effect.succeed(Number.NaN)
        })
      )

      expect(Either.isLeft(outcome)).toBe(true)

      if (Either.isRight(outcome)) {
        return
      }

      expect(outcome.left).toBeInstanceOf(NoSuccessfulTrials)
    }))

  it.effect("maps cache corruption failures into trial failures in optimize path", () =>
    Effect.gen(function*() {
      const corruption = new Cache.CacheCorrupt({
        key: "study:v1:corrupt-optimize-path",
        reason: "forced-corruption"
      })

      const failingSchemaCacheLayer = Layer.effect(
        Cache.SchemaCache,
        Cache.makeSchemaCache().pipe(
          Effect.map((schemaCache) => ({
            ...schemaCache,
            resolve: () => Effect.fail(corruption)
          }))
        )
      ).pipe(Layer.provide(KeyValueStore.layerMemory))

      const objectiveCacheLayer = Study.StudyObjectiveCacheLive(
        Study.studyObjectiveCacheOptions("optimize-cache-corrupt")
      ).pipe(Layer.provide(failingSchemaCacheLayer))

      const result = yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 21 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(0),
          objective: (raw) => {
            const config = decodeObjectiveConfig(raw)
            return Effect.succeed(abs(config.x) + config.depth)
          }
        }).pipe(
          Stream.provideLayer(objectiveCacheLayer)
        )
      )

      const events = Chunk.toReadonlyArray(result)
      const failedTrialEvent = events.find((event) => event._tag === "TrialFailed")

      expect(failedTrialEvent?._tag).toBe("TrialFailed")

      if (failedTrialEvent?._tag !== "TrialFailed") {
        return
      }

      expect(failedTrialEvent.error).toBeInstanceOf(TrialError)
      expect(failedTrialEvent.error.cause).toEqual(corruption)
      expect(failedTrialEvent.error.message).toBe("objective cache failure: effect-search/CacheCorrupt")
    }))

  it.effect("maps cache backend failures into trial failures in optimize path", () =>
    Effect.gen(function*() {
      const backendFailure = new Cache.CacheBackendError({
        operation: "get",
        reason: "forced-backend-failure"
      })

      const failingSchemaCacheLayer = Layer.effect(
        Cache.SchemaCache,
        Cache.makeSchemaCache().pipe(
          Effect.map((schemaCache) => ({
            ...schemaCache,
            resolve: () => Effect.fail(backendFailure)
          }))
        )
      ).pipe(Layer.provide(KeyValueStore.layerMemory))

      const objectiveCacheLayer = Study.StudyObjectiveCacheLive(
        Study.studyObjectiveCacheOptions("optimize-cache-backend")
      ).pipe(Layer.provide(failingSchemaCacheLayer))

      const result = yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 21 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(0),
          objective: (raw) => {
            const config = decodeObjectiveConfig(raw)
            return Effect.succeed(abs(config.x) + config.depth)
          }
        }).pipe(
          Stream.provideLayer(objectiveCacheLayer)
        )
      )

      const events = Chunk.toReadonlyArray(result)
      const failedTrialEvent = events.find((event) => event._tag === "TrialFailed")

      expect(failedTrialEvent?._tag).toBe("TrialFailed")

      if (failedTrialEvent?._tag !== "TrialFailed") {
        return
      }

      expect(failedTrialEvent.error).toBeInstanceOf(TrialError)
      expect(failedTrialEvent.error.cause).toEqual(backendFailure)
      expect(failedTrialEvent.error.message).toBe("objective cache failure: effect-search/CacheBackendError")
    }))
})
