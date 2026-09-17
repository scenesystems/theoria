import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Effect,
  Either,
  Layer,
  Match,
  MutableRef,
  Number as Num,
  Ref,
  Schedule,
  Schema,
  Tuple
} from "effect"

import * as Cache from "../../src/Cache.js"
import * as ObjectiveCache from "../../src/ObjectiveCache.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import type * as Trial from "../../src/Trial.js"

class SchemaConfig extends Schema.Class<SchemaConfig>("SchemaConfig")({
  label: Schema.String,
  value: Schema.Number
}) {}

const ConfigSchema = Schema.Struct({
  label: Schema.String,
  value: Schema.Number
})

const NestedConfigSchema = Schema.Struct({
  label: Schema.String,
  nested: Schema.Struct({ value: Schema.Number })
})

const completedWithValue = (expected: number) =>
  Match.type<Trial.State>().pipe(
    Match.tag("Completed", ({ value }) =>
      Match.value(value).pipe(
        Match.when(Match.number, Num.between({ minimum: expected, maximum: expected })),
        Match.orElse(() => false)
      )),
    Match.orElse(() => false)
  )

const singleChoiceSpace = () =>
  SearchSpace.make({
    choice: SearchSpace.categorical(Arr.of("only"))
  })

describe("ObjectiveCache", () => {
  it.effect("deduplicates repeated objective evaluations when the ObjectiveCache layer is provided", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      const result = yield* Optimization.run({
        space: yield* singleChoiceSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "minimize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      }).pipe(Effect.provide(ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: "optimization-cache" }))))

      const calls = yield* Ref.get(invocations)

      expect(calls).toBe(1)
      expect(result.trials).toHaveLength(4)
      expect(Arr.every(Arr.fromIterable(result.trials), (trial) => completedWithValue(1)(trial.state))).toBe(true)
    }))

  it.live("single-flights per key under maximum contention", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      const result = yield* Optimization.run({
        space: yield* singleChoiceSpace(),
        sampler: Sampler.random({ seed: 41 }),
        direction: "minimize",
        trials: 12,
        concurrency: 12,
        retrySchedule: Schedule.recurs(0),
        objective: () =>
          Ref.updateAndGet(invocations, Num.increment).pipe(
            Effect.zipLeft(Effect.sleep("10 millis"))
          )
      }).pipe(
        Effect.provide(ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: "stress-single-flight" })))
      )

      const calls = yield* Ref.get(invocations)

      expect(calls).toBe(1)
      expect(result.trials).toHaveLength(12)
      expect(Arr.every(Arr.fromIterable(result.trials), (trial) => completedWithValue(1)(trial.state))).toBe(true)
    }))

  it.scoped("isolates cached objective values by configured optimization scope", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "effect-search-optimization-objective-cache-"
      })
      const invocations = yield* Ref.make(0)
      const space = yield* singleChoiceSpace()

      const evaluate = () => Ref.updateAndGet(invocations, Num.increment)
      const runScoped = (scope: string) =>
        Optimization.run({
          space,
          sampler: Sampler.random({ seed: 31 }),
          direction: "minimize",
          trials: 2,
          concurrency: 1,
          objective: evaluate
        }).pipe(Effect.provide(ObjectiveCache.layerFileSystem(directory, new ObjectiveCache.Options({ scope }))))

      yield* runScoped("scope-a")
      yield* runScoped("scope-a")
      yield* runScoped("scope-b")

      expect(yield* Ref.get(invocations)).toBe(2)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("falls back to uncached objective execution when ObjectiveCache is absent", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      yield* Optimization.run({
        space: yield* singleChoiceSpace(),
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
      const cache = yield* Cache.Cache
      const corruption = new Cache.Corrupt({
        key: "optimization:forced-corrupt",
        reason: "forced-corrupt"
      })

      const corruptedCache: Cache.Service = {
        get: cache.get,
        set: cache.set,
        remove: cache.remove,
        resolve: () => Effect.fail(corruption)
      }

      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provideService(Cache.Cache, corruptedCache)
      )

      const resolved = yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: Schema.Struct({ trial: Schema.Number }),
          config: { trial: 1 },
          compute: Effect.succeed(0.5)
        })
      ).pipe(Effect.either)

      expect(resolved).toEqual(Either.left(corruption))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("propagates backend failures on invalidate", () =>
    Effect.gen(function*() {
      const cache = yield* Cache.Cache
      const backendFailure = new Cache.BackendError({
        operation: "remove",
        reason: "forced-backend-failure"
      })

      const removed = yield* Ref.make(false)
      const failingCache: Cache.Service = {
        get: cache.get,
        set: cache.set,
        resolve: cache.resolve,
        remove: () =>
          Effect.gen(function*() {
            yield* Ref.set(removed, true)
            return yield* backendFailure
          })
      }

      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provideService(Cache.Cache, failingCache)
      )

      const invalidated = yield* objectiveCache.invalidate(
        Schema.Struct({ trial: Schema.Number }),
        { trial: 7 }
      ).pipe(Effect.either)

      expect(yield* Ref.get(removed)).toBe(true)
      expect(invalidated).toEqual(Either.left(backendFailure))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("Cache.Observer receives Miss on first resolve and Hit on second", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make(Arr.empty<Cache.Event>())
      const observerLayer = Layer.succeed(Cache.Observer, {
        record: (event) => Ref.update(events, Arr.append(event))
      })

      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provide(observerLayer)
      )

      const schema = Schema.Struct({ x: Schema.Number })
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema,
          config: { x: 1 },
          compute: Effect.succeed(42)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema,
          config: { x: 1 },
          compute: Effect.succeed(42)
        })
      )

      const recorded = yield* Ref.get(events)
      expect(recorded).toHaveLength(2)

      const first = Arr.get(recorded, 0).pipe(Either.fromOption(() => "expected first event"))
      expect(Either.map(first, (result) => result._tag)).toEqual(Either.right("Miss"))

      const second = Arr.get(recorded, 1).pipe(Either.fromOption(() => "expected second event"))
      expect(Either.map(second, (result) => result._tag)).toEqual(Either.right("Hit"))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("Cache.Observer receives Invalidation event on invalidate", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make(Arr.empty<Cache.Event>())
      const observerLayer = Layer.succeed(Cache.Observer, {
        record: (event) => Ref.update(events, Arr.append(event))
      })

      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provide(observerLayer)
      )

      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: Schema.String,
          config: "key-a",
          compute: Effect.succeed(10)
        })
      )
      yield* objectiveCache.invalidate(Schema.String, "key-a")

      const recorded = yield* Ref.get(events)
      expect(recorded).toHaveLength(2)

      const invalidation = Arr.get(recorded, 1).pipe(Either.fromOption(() => "expected invalidation event"))
      expect(Either.map(invalidation, (result) => result._tag)).toEqual(Either.right("Invalidation"))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("preserves known identity-schema fingerprints and supports nested schema configs", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make(Arr.empty<Cache.Event>())
      const observerLayer = Layer.succeed(Cache.Observer, {
        record: (event) => Ref.update(events, Arr.append(event))
      })
      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provide(observerLayer)
      )
      const firstSchema = new SchemaConfig({ label: "shared", value: 1 })
      const repeatedSchema = new SchemaConfig({ label: "shared", value: 1 })
      const distinctSchema = new SchemaConfig({ label: "shared", value: 2 })
      const firstConfig = { label: "shared", value: 1 }
      const distinctConfig = { label: "shared", value: 2 }

      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: SchemaConfig,
          config: firstSchema,
          compute: Effect.succeed(1)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: SchemaConfig,
          config: repeatedSchema,
          compute: Effect.succeed(1)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: SchemaConfig,
          config: distinctSchema,
          compute: Effect.succeed(2)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: ConfigSchema,
          config: firstConfig,
          compute: Effect.succeed(1)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: ConfigSchema,
          config: distinctConfig,
          compute: Effect.succeed(2)
        })
      )
      yield* objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema: NestedConfigSchema,
          config: { label: "nested", nested: { value: 3 } },
          compute: Effect.succeed(3)
        })
      )

      const recorded = yield* Ref.get(events)
      const fingerprints = Arr.map(recorded, ({ fingerprint }) => fingerprint)

      expect(fingerprints).toEqual(Arr.make(
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:p9LBI0jiNuLgbM7SoTuTK6Bhf9WedALSKINdPc6tsDo",
        "blake3-256:eNAldYVmdguq9wLJMKZB8P8sugAAfF9VZ2KzjH4dRgU",
        "blake3-256:p9LBI0jiNuLgbM7SoTuTK6Bhf9WedALSKINdPc6tsDo",
        // Independent Python blake3 vector for {"label":"nested","nested":{"value":3}}.
        "blake3-256:tI9fG4f8dR2RPPL_TLNn0Da8xZcC8Wohy8PtZ7b4fMc"
      ))
      expect(Arr.map(recorded, ({ _tag }) => _tag)).toEqual(Arr.make("Miss", "Hit", "Miss", "Hit", "Hit", "Miss"))
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("fingerprints a transformed config by its encoded preimage without double encoding", () =>
    Effect.gen(function*() {
      const events = yield* Ref.make(Arr.empty<Cache.Event>())
      const invocations = yield* Ref.make(0)
      const observerLayer = Layer.succeed(Cache.Observer, {
        record: (event) => Ref.update(events, Arr.append(event))
      })
      const objectiveCache = yield* ObjectiveCache.make().pipe(Effect.provide(observerLayer))
      const compute = Ref.updateAndGet(invocations, Num.increment)
      const encodes = MutableRef.make(0)
      const schema = Schema.transform(Schema.NumberFromString, Schema.Number, {
        strict: true,
        decode: (value) => value,
        encode: (value) => {
          MutableRef.increment(encodes)
          return value
        }
      })
      const operation = objectiveCache.resolve(
        new ObjectiveCache.Request({
          schema,
          config: 42,
          compute
        })
      )
      const invalidate = objectiveCache.invalidate(schema, 42)
      expect(MutableRef.get(encodes)).toBe(0)
      const first = yield* operation
      const second = yield* operation
      expect(MutableRef.get(encodes)).toBe(2)
      // Independent Python blake3 vector for the JSON string "42", not the number 42.
      const expectedFingerprint = "blake3-256:zhcWBch3D0RH9i6l-2JwL8nCGRSKehTk3oapeEHfQG4"
      const recorded = yield* Ref.get(events)

      expect(first).toEqual(new Cache.Result({ value: 1, resolution: "miss" }))
      expect(second).toEqual(new Cache.Result({ value: 1, resolution: "hit" }))
      expect(yield* Ref.get(invocations)).toBe(1)
      expect(Arr.map(recorded, ({ fingerprint }) => fingerprint)).toEqual(Arr.make(
        expectedFingerprint,
        expectedFingerprint
      ))
      expect(Arr.map(recorded, ({ _tag }) => _tag)).toEqual(Arr.make("Miss", "Hit"))
      yield* invalidate
      expect(MutableRef.get(encodes)).toBe(3)
      expect(yield* operation).toEqual(new Cache.Result({ value: 2, resolution: "miss" }))
      expect(MutableRef.get(encodes)).toBe(4)
    }).pipe(Effect.provide(Cache.layerMemory)))

  it.effect("fails key preparation without compute, backend, or observer side effects", () =>
    Effect.gen(function*() {
      const cache = yield* Cache.Cache
      const events = yield* Ref.make(Arr.empty<Cache.Event>())
      const computed = yield* Ref.make(false)
      const backendCalled = yield* Ref.make(false)
      const observerLayer = Layer.succeed(Cache.Observer, {
        record: (event) => Ref.update(events, Arr.append(event))
      })
      const permissiveCache: Cache.Service = {
        get: cache.get,
        set: cache.set,
        resolve: ({ compute }) =>
          Ref.set(backendCalled, true).pipe(
            Effect.zipRight(compute),
            Effect.map((value) => new Cache.Result({ value, resolution: "miss" }))
          ),
        remove: () => Ref.set(backendCalled, true)
      }
      const objectiveCache = yield* ObjectiveCache.make().pipe(
        Effect.provide(observerLayer),
        Effect.provideService(Cache.Cache, permissiveCache)
      )
      const malformedValue = yield* Effect.either(
        objectiveCache.resolve(
          new ObjectiveCache.Request({
            schema: Schema.Struct({ text: Schema.String }),
            config: { text: "\uD800" },
            compute: Ref.set(computed, true).pipe(Effect.as(1))
          })
        )
      )
      const malformedKey = yield* Effect.either(
        objectiveCache.invalidate(
          Schema.Record({ key: Schema.String, value: Schema.String }),
          { ["\uD800"]: "value" }
        )
      )
      const encodingFailure = yield* Effect.either(
        objectiveCache.resolve(
          new ObjectiveCache.Request({
            schema: Schema.Struct({ text: Schema.NonEmptyString }),
            config: { text: "" },
            compute: Ref.set(computed, true).pipe(Effect.as(1))
          })
        )
      )
      const expected = new Cache.Corrupt({
        key: "optimization/objective:",
        reason: "fingerprint failure: InvalidUnicode"
      })

      expect(malformedValue).toEqual(Either.left(expected))
      expect(malformedKey).toEqual(Either.left(expected))
      expect(Either.isLeft(encodingFailure)).toBe(true)

      const encodingCorrupt = Either.match(encodingFailure, {
        onLeft: (error) =>
          Match.value(error).pipe(
            Match.tag("effect-search/CacheCorrupt", ({ key, reason }) => Tuple.make(key, reason)),
            Match.orElse(() => Tuple.make("unexpected cache error", "unexpected cache error"))
          ),
        onRight: () => Tuple.make("unexpected success", "unexpected success")
      })
      expect(Tuple.getFirst(encodingCorrupt)).toBe("optimization/objective:")
      expect(Tuple.getSecond(encodingCorrupt)).toContain("Expected")

      expect(yield* Ref.get(computed)).toBe(false)
      expect(yield* Ref.get(backendCalled)).toBe(false)
      expect(yield* Ref.get(events)).toEqual(Arr.empty())
    }).pipe(Effect.provide(Cache.layerMemory)))
})
