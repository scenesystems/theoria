import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, Either, Layer, Number as Num, Ref, Schedule, Schema, Tuple } from "effect"

import * as Cache from "../../src/Cache/index.js"
import type { CacheObservabilityEvent } from "../../src/Cache/observer.js"
import { CacheObserver } from "../../src/Cache/observer.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

class SchemaConfig extends Schema.Class<SchemaConfig>("SchemaConfig")({
  label: Schema.String,
  value: Schema.Number
}) {}

class DataConfig extends Data.Class<{
  readonly label: string
  readonly value: number
}> {}

const singleChoiceSpace = () =>
  SearchSpace.unsafeMake({
    choice: SearchSpace.categorical(["only"])
  })

describe("StudyObjectiveCache", () => {
  it.effect("deduplicates repeated objective evaluations when StudyObjectiveCache layer is provided", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      const result = yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "minimize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      }).pipe(Effect.provide(Study.StudyObjectiveCacheMemory(Study.studyObjectiveCacheOptions("study-cache"))))

      const calls = yield* Ref.get(invocations)

      expect(calls).toBe(1)
      expect(result.trials).toHaveLength(4)
      expect(result.trials.every((trial) => trial.state._tag === "Completed" && trial.state.value === 1)).toBe(true)
    }))

  it.live("single-flights per key under maximum contention", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      const result = yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 41 }),
        direction: "minimize",
        trials: 12,
        concurrency: 12,
        retrySchedule: Schedule.recurs(0),
        objective: () =>
          Ref.updateAndGet(invocations, Num.increment).pipe(
            Effect.zipLeft(Effect.sleep("10 millis"))
          )
      }).pipe(Effect.provide(Study.StudyObjectiveCacheMemory(Study.studyObjectiveCacheOptions("stress-single-flight"))))

      const calls = yield* Ref.get(invocations)

      expect(calls).toBe(1)
      expect(result.trials).toHaveLength(12)
      expect(result.trials.every((trial) => trial.state._tag === "Completed" && trial.state.value === 1)).toBe(true)
    }))

  it.scoped("isolates cached objective values by configured study scope", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-study-objective-cache-" })
      const invocations = yield* Ref.make(0)

      const evaluate = () => Ref.updateAndGet(invocations, Num.increment)
      const runScoped = (scope: string) =>
        Study.optimize({
          space: singleChoiceSpace(),
          sampler: Sampler.random({ seed: 31 }),
          direction: "minimize",
          trials: 2,
          concurrency: 1,
          objective: evaluate
        }).pipe(Effect.provide(Study.StudyObjectiveCacheFileSystem(directory, Study.studyObjectiveCacheOptions(scope))))

      yield* runScoped("scope-a")
      yield* runScoped("scope-a")
      yield* runScoped("scope-b")

      expect(yield* Ref.get(invocations)).toBe(2)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("falls back to uncached objective execution when StudyObjectiveCache is absent", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "minimize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      })

      expect(yield* Ref.get(invocations)).toBe(4)
    }))

  it.effect("propagates cache decode corruption failures instead of treating them as misses", () =>
    Effect.gen(function*() {
      const schemaCache = yield* Cache.SchemaCache
      const corruption = new Cache.CacheCorrupt({
        key: "study:v1:forced-corrupt",
        reason: "forced-corrupt"
      })

      const corruptedSchemaCache = {
        ...schemaCache,
        resolve: <Key, Value, E, Requirement, EncodedKey = Key, EncodedValue = Value>(
          _args: {
            readonly descriptor: Cache.CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
            readonly key: Key
            readonly compute: Effect.Effect<Value, E, Requirement>
          }
        ): Effect.Effect<readonly [Value, Cache.CacheResolution], E | Cache.CacheError, Requirement> =>
          Effect.fail(corruption)
      }

      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provideService(Cache.SchemaCache, corruptedSchemaCache)
      )

      const resolved = yield* objectiveCache.resolve({
        config: { trial: 1 },
        compute: Effect.succeed(0.5)
      }).pipe(Effect.either)

      expect(resolved).toEqual(Either.left(corruption))
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

  it.effect("propagates backend failures on invalidate", () =>
    Effect.gen(function*() {
      const schemaCache = yield* Cache.SchemaCache
      const backendFailure = new Cache.CacheBackendError({
        operation: "remove",
        reason: "forced-backend-failure"
      })

      const removed = yield* Ref.make(false)
      const failingSchemaCache = {
        ...schemaCache,
        remove: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
          _descriptor: Cache.CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
          _key: Key
        ) =>
          Effect.gen(function*() {
            yield* Ref.set(removed, true)
            return yield* Effect.fail(backendFailure)
          })
      }

      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provideService(Cache.SchemaCache, failingSchemaCache)
      )

      const invalidated = yield* objectiveCache.invalidate({ trial: 7 }).pipe(Effect.either)

      expect(yield* Ref.get(removed)).toBe(true)
      expect(invalidated).toEqual(Either.left(backendFailure))
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

  it.effect("CacheObserver receives Miss on first resolve and Hit on second", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make<ReadonlyArray<CacheObservabilityEvent>>([])
      const observerLayer = Layer.succeed(CacheObserver, {
        record: (event) => Ref.update(events, (arr) => [...arr, event])
      })

      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provide(observerLayer)
      )

      yield* objectiveCache.resolve({ config: { x: 1 }, compute: Effect.succeed(42) })
      yield* objectiveCache.resolve({ config: { x: 1 }, compute: Effect.succeed(42) })

      const recorded = yield* Ref.get(events)
      expect(recorded).toHaveLength(2)

      const first = Arr.get(recorded, 0).pipe(Either.fromOption(() => "expected first event"))
      expect(Either.map(first, (result) => result._tag)).toEqual(Either.right("Miss"))

      const second = Arr.get(recorded, 1).pipe(Either.fromOption(() => "expected second event"))
      expect(Either.map(second, (result) => result._tag)).toEqual(Either.right("Hit"))
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

  it.effect("CacheObserver receives Invalidation event on invalidate", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make<ReadonlyArray<CacheObservabilityEvent>>([])
      const observerLayer = Layer.succeed(CacheObserver, {
        record: (event) => Ref.update(events, (arr) => [...arr, event])
      })

      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provide(observerLayer)
      )

      yield* objectiveCache.resolve({ config: "key-a", compute: Effect.succeed(10) })
      yield* objectiveCache.invalidate("key-a")

      const recorded = yield* Ref.get(events)
      expect(recorded).toHaveLength(2)

      const invalidation = Arr.get(recorded, 1).pipe(Either.fromOption(() => "expected invalidation event"))
      expect(Either.map(invalidation, (result) => result._tag)).toEqual(Either.right("Invalidation"))
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

  it.effect("fingerprints Schema and Data class configs by their stable encoded wire", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make<ReadonlyArray<CacheObservabilityEvent>>([])
      const observerLayer = Layer.succeed(CacheObserver, {
        record: (event) => Ref.update(events, (arr) => [...arr, event])
      })
      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provide(observerLayer)
      )
      const firstSchema = new SchemaConfig({ label: "shared", value: 1 })
      const repeatedSchema = new SchemaConfig({ label: "shared", value: 1 })
      const distinctSchema = new SchemaConfig({ label: "shared", value: 2 })
      const firstData = new DataConfig({ label: "shared", value: 1 })
      const distinctData = new DataConfig({ label: "shared", value: 2 })

      yield* objectiveCache.resolve({ config: firstSchema, compute: Effect.succeed(1) })
      yield* objectiveCache.resolve({ config: repeatedSchema, compute: Effect.succeed(1) })
      yield* objectiveCache.resolve({ config: distinctSchema, compute: Effect.succeed(2) })
      yield* objectiveCache.resolve({ config: firstData, compute: Effect.succeed(1) })
      yield* objectiveCache.resolve({ config: distinctData, compute: Effect.succeed(2) })

      const recorded = yield* Ref.get(events)
      const fingerprints = Arr.map(recorded, ({ fingerprint }) => fingerprint)

      expect(fingerprints).toEqual([
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:p9LBI0jiNuLgbM7SoTuTK6Bhf9WedALSKINdPc6tsDo",
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:p9LBI0jiNuLgbM7SoTuTK6Bhf9WedALSKINdPc6tsDo"
      ])
      expect(Arr.map(recorded, ({ _tag }) => _tag)).toEqual(["Miss", "Hit", "Miss", "Hit", "Hit"])
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

  it.effect("propagates key encoding and malformed Unicode failures without computing or observing unknown", () =>
    Effect.gen(function*() {
      const schemaCache = yield* Cache.SchemaCache
      const events = yield* Ref.make<ReadonlyArray<CacheObservabilityEvent>>([])
      const computed = yield* Ref.make(false)
      const backendCalled = yield* Ref.make(false)
      const observerLayer = Layer.succeed(CacheObserver, {
        record: (event) => Ref.update(events, (arr) => [...arr, event])
      })
      const permissiveSchemaCache = {
        ...schemaCache,
        resolve: <Key, Value, E, Requirement, EncodedKey = Key, EncodedValue = Value>({
          compute
        }: {
          readonly descriptor: Cache.CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
          readonly key: Key
          readonly compute: Effect.Effect<Value, E, Requirement>
        }): Effect.Effect<readonly [Value, Cache.CacheResolution], E | Cache.CacheError, Requirement> =>
          Ref.set(backendCalled, true).pipe(
            Effect.zipRight(compute),
            Effect.map((value) => Tuple.make(value, "miss"))
          ),
        remove: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
          _descriptor: Cache.CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
          _key: Key
        ) => Ref.set(backendCalled, true)
      }
      const objectiveCache = yield* Study.makeStudyObjectiveCache().pipe(
        Effect.provide(observerLayer),
        Effect.provideService(Cache.SchemaCache, permissiveSchemaCache)
      )
      const malformedValue = yield* Effect.either(
        objectiveCache.resolve({
          config: { text: "\uD800" },
          compute: Ref.set(computed, true).pipe(Effect.as(1))
        })
      )
      const malformedKey = yield* Effect.either(objectiveCache.invalidate({ ["\uD800"]: "value" }))
      const encodingFailure = yield* Effect.either(
        objectiveCache.resolve({
          config: undefined,
          compute: Ref.set(computed, true).pipe(Effect.as(1))
        })
      )
      const expected = new Cache.CacheCorrupt({
        key: "study/objective:v1:",
        reason: "fingerprint failure: InvalidUnicode"
      })

      expect(malformedValue).toEqual(Either.left(expected))
      expect(malformedKey).toEqual(Either.left(expected))
      expect(Either.isLeft(encodingFailure)).toBe(true)

      if (Either.isLeft(encodingFailure)) {
        expect(encodingFailure.left).toBeInstanceOf(Cache.CacheCorrupt)

        if (encodingFailure.left._tag === "effect-search/CacheCorrupt") {
          expect(encodingFailure.left.key).toBe("study/objective:v1:")
          expect(encodingFailure.left.reason).toContain("Expected")
        }
      }

      expect(yield* Ref.get(computed)).toBe(false)
      expect(yield* Ref.get(backendCalled)).toBe(false)
      expect(yield* Ref.get(events)).toEqual([])
    }).pipe(Effect.provide(Cache.SchemaCacheMemory)))
})
