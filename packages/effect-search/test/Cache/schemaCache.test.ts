import * as Reactivity from "@effect/experimental/Reactivity"
import * as PlatformError from "@effect/platform/Error"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as SqlClient from "@effect/sql/SqlClient"
import type * as SqlConnection from "@effect/sql/SqlConnection"
import { SqlError } from "@effect/sql/SqlError"
import * as Statement from "@effect/sql/Statement"
import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Match,
  MutableRef,
  Number as Num,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str,
  TestClock,
  Tuple
} from "effect"

import * as Cache from "../../src/Cache/index.js"

const Rows = Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
const descriptor = Cache.makeDescriptor("rows", "v1", Schema.String, Schema.Number)

const makeStore = (
  get: (key: string) => Effect.Effect<Option.Option<string>, PlatformError.PlatformError>,
  set: (key: string, value: string) => Effect.Effect<void, PlatformError.PlatformError>,
  remove: (key: string) => Effect.Effect<void, PlatformError.PlatformError>
): KeyValueStore.KeyValueStore =>
  KeyValueStore.makeStringOnly({
    get,
    set,
    remove,
    clear: Effect.void,
    size: Effect.succeed(0)
  })

const makeCache = (store: KeyValueStore.KeyValueStore) =>
  Cache.makeSchemaCache().pipe(Effect.provideService(KeyValueStore.KeyValueStore, store))

const makeDelayedReadStore = Effect.gen(function*() {
  const backing = yield* Ref.make(Option.some("1"))
  const readGate = yield* Deferred.make<void>()
  const readCaptured = yield* Deferred.make<void>()
  const mutationStarted = yield* Deferred.make<void>()
  const delayFirstRead = yield* Ref.make(true)
  const get = (_key: string) =>
    Effect.gen(function*() {
      const captured = yield* Ref.get(backing)
      const delayed = yield* Ref.getAndSet(delayFirstRead, false)
      yield* Effect.if(delayed, {
        onTrue: () =>
          Deferred.succeed(readCaptured, undefined).pipe(
            Effect.zipRight(Deferred.await(readGate))
          ),
        onFalse: () => Effect.void
      })
      return captured
    })
  const set = (_key: string, value: string) =>
    Deferred.succeed(mutationStarted, undefined).pipe(
      Effect.zipRight(Ref.set(backing, Option.some(value)))
    )
  const remove = (_key: string) =>
    Deferred.succeed(mutationStarted, undefined).pipe(
      Effect.zipRight(Ref.set(backing, Option.none()))
    )
  return { backing, readGate, readCaptured, mutationStarted, store: makeStore(get, set, remove) }
})

const backendFailure = (method: string) =>
  new PlatformError.SystemError({
    reason: "Unknown",
    module: "KeyValueStore",
    method
  })

const sqlRows = (rows: typeof Rows.Type) => {
  const unavailable = new SqlError({ message: "Unconfigured SQL connection operation" })
  const connection: SqlConnection.Connection = {
    execute: () => Effect.succeed(rows),
    executeRaw: () => Effect.fail(unavailable),
    executeStream: () => Stream.fail(unavailable),
    executeValues: () => Effect.fail(unavailable),
    executeUnprepared: () => Effect.fail(unavailable)
  }
  return Layer.effect(
    SqlClient.SqlClient,
    SqlClient.make({
      acquirer: Effect.succeed(connection),
      compiler: Statement.makeCompilerSqlite(),
      spanAttributes: Arr.empty()
    })
  ).pipe(Layer.provide(Reactivity.layer))
}

it.scoped.each(Arr.make(
  Tuple.make("absent", Arr.empty<typeof Rows.Type[number]>(), Option.none<number>()),
  Tuple.make("present", Arr.of({ value: "42" }), Option.some(42))
))("reads a %s persisted SQL cache entry", ([, rows, expected]) =>
  Effect.gen(function*() {
    const cache = yield* Cache.SchemaCache
    expect(yield* cache.get(descriptor, "key")).toEqual(expected)
  }).pipe(Effect.provide(Cache.SchemaCacheSql(sqlRows(rows)))))

it.scoped("classifies a malformed SQL row as a backend failure rather than a corrupt cached value", () =>
  Effect.gen(function*() {
    const cache = yield* Cache.SchemaCache
    const error = yield* Effect.flip(cache.get(descriptor, "key"))
    expect(error).toMatchObject({ _tag: "effect-search/CacheBackendError", operation: "get" })
  }).pipe(Effect.provide(Cache.SchemaCacheSql(sqlRows(Arr.of({ value: 42 }))))))

it.effect("defers synchronous key encoding until each cache operation executes", () =>
  Effect.gen(function*() {
    const encodes = MutableRef.make(0)
    const keySchema = Schema.transform(Schema.String, Schema.String, {
      strict: true,
      decode: Str.toLowerCase,
      encode: (key) => {
        MutableRef.increment(encodes)
        return Str.toUpperCase(key)
      }
    })
    const keyed = Cache.makeDescriptor("lazy", "v1", keySchema, Schema.Number)
    const cache = yield* Cache.SchemaCache
    const write = cache.set(keyed, "key", 73)
    const read = cache.get(keyed, "key")
    const remove = cache.remove(keyed, "key")
    expect(MutableRef.get(encodes)).toBe(0)
    yield* write
    expect(yield* read).toEqual(Option.some(73))
    yield* remove
    expect(yield* read).toEqual(Option.none())
    expect(MutableRef.get(encodes)).toBe(4)
  }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

it.scoped("serializes a delayed cold get before a set of the same key", () =>
  Effect.gen(function*() {
    const controlled = yield* makeDelayedReadStore
    const cache = yield* makeCache(controlled.store)
    const reading = yield* Effect.fork(cache.get(descriptor, "key"))
    yield* Deferred.await(controlled.readCaptured)
    const setting = yield* Effect.fork(cache.set(descriptor, "key", 2))
    yield* Effect.yieldNow()

    expect(yield* Deferred.isDone(controlled.mutationStarted)).toBe(false)
    yield* Deferred.succeed(controlled.readGate, undefined)
    expect(yield* Fiber.join(reading)).toEqual(Option.some(1))
    yield* Fiber.join(setting)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(2))
  }))

it.scoped("serializes a delayed cold get before removal of the same key", () =>
  Effect.gen(function*() {
    const controlled = yield* makeDelayedReadStore
    const cache = yield* makeCache(controlled.store)
    const reading = yield* Effect.fork(cache.get(descriptor, "key"))
    yield* Deferred.await(controlled.readCaptured)
    const removing = yield* Effect.fork(cache.remove(descriptor, "key"))
    yield* Effect.yieldNow()

    expect(yield* Deferred.isDone(controlled.mutationStarted)).toBe(false)
    yield* Deferred.succeed(controlled.readGate, undefined)
    expect(yield* Fiber.join(reading)).toEqual(Option.some(1))
    yield* Fiber.join(removing)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.none())
  }))

it.scoped("invalidates local state when an interrupted set may have committed", () =>
  Effect.gen(function*() {
    const backing = yield* Ref.make(Option.some("1"))
    const committed = yield* Deferred.make<void>()
    const store = makeStore(
      () => Ref.get(backing),
      (_key, value) =>
        Ref.set(backing, Option.some(value)).pipe(
          Effect.zipRight(Deferred.succeed(committed, undefined)),
          Effect.zipRight(Effect.never)
        ),
      () => Ref.set(backing, Option.none())
    )
    const cache = yield* makeCache(store)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(1))
    const setting = yield* Effect.fork(cache.set(descriptor, "key", 2))
    yield* Deferred.await(committed)

    expect(yield* Fiber.interrupt(setting)).toSatisfy(Exit.isInterrupted)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(2))
  }))

it.scoped("invalidates local state when an interrupted removal may have committed", () =>
  Effect.gen(function*() {
    const backing = yield* Ref.make(Option.some("1"))
    const committed = yield* Deferred.make<void>()
    const store = makeStore(
      () => Ref.get(backing),
      (_key, value) => Ref.set(backing, Option.some(value)),
      () =>
        Ref.set(backing, Option.none()).pipe(
          Effect.zipRight(Deferred.succeed(committed, undefined)),
          Effect.zipRight(Effect.never)
        )
    )
    const cache = yield* makeCache(store)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(1))
    const removing = yield* Effect.fork(cache.remove(descriptor, "key"))
    yield* Deferred.await(committed)

    expect(yield* Fiber.interrupt(removing)).toSatisfy(Exit.isInterrupted)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.none())
    yield* cache.set(descriptor, "key", 4)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(4))
  }))

it.scoped("preserves backing mutation failures and discards uncertain cached values", () =>
  Effect.gen(function*() {
    const backing = yield* Ref.make(Option.some("1"))
    const store = makeStore(
      () => Ref.get(backing),
      (_key, value) => Ref.set(backing, Option.some(value)).pipe(Effect.zipRight(Effect.fail(backendFailure("set")))),
      () => Ref.set(backing, Option.none()).pipe(Effect.zipRight(Effect.fail(backendFailure("remove"))))
    )
    const cache = yield* makeCache(store)
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(1))
    expect(yield* Effect.flip(cache.set(descriptor, "key", 2))).toMatchObject({
      _tag: "effect-search/CacheBackendError",
      operation: "set"
    })
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(2))
    expect(yield* Effect.flip(cache.remove(descriptor, "key"))).toMatchObject({
      _tag: "effect-search/CacheBackendError",
      operation: "remove"
    })
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.none())
  }))

it.scoped("does not encode or persist a queued write cancelled before acquiring its key", () =>
  Effect.gen(function*() {
    const controlled = yield* makeDelayedReadStore
    const encodes = MutableRef.make(0)
    const valueSchema = Schema.transform(Schema.Number, Schema.Number, {
      strict: true,
      decode: (value) => value,
      encode: (value) => {
        MutableRef.increment(encodes)
        return value
      }
    })
    const encodedDescriptor = Cache.makeDescriptor("rows", "v1", Schema.String, valueSchema)
    const cache = yield* makeCache(controlled.store)
    const reading = yield* Effect.fork(cache.get(encodedDescriptor, "key"))
    yield* Deferred.await(controlled.readCaptured)
    const setting = yield* Effect.fork(cache.set(encodedDescriptor, "key", 2))
    yield* Effect.yieldNow()
    expect(MutableRef.get(encodes)).toBe(0)
    expect(yield* Fiber.interrupt(setting)).toSatisfy(Exit.isInterrupted)
    yield* Deferred.succeed(controlled.readGate, undefined)
    expect(yield* Fiber.join(reading)).toEqual(Option.some(1))
    expect(yield* Ref.get(controlled.backing)).toEqual(Option.some("1"))
    yield* cache.set(encodedDescriptor, "key", 3)
    expect(MutableRef.get(encodes)).toBe(1)
    expect(yield* cache.get(encodedDescriptor, "key")).toEqual(Option.some(3))
  }))

it.scoped("allows a caller queued on a same-key lock to be cancelled", () =>
  Effect.gen(function*() {
    const readGate = yield* Deferred.make<void>()
    const readStarted = yield* Deferred.make<void>()
    const secondKeyEncoded = yield* Deferred.make<void>()
    const keyEncodes = yield* Ref.make(0)
    const keySchema = Schema.transformOrFail(Schema.String, Schema.String, {
      strict: true,
      decode: (key) => Effect.succeed(Str.toLowerCase(key)),
      encode: (key) =>
        Ref.updateAndGet(keyEncodes, Num.increment).pipe(
          Effect.tap((attempt) =>
            Match.value(attempt).pipe(
              Match.when(2, () => Deferred.succeed(secondKeyEncoded, undefined)),
              Match.orElse(() => Effect.void)
            )
          ),
          Effect.as(Str.toUpperCase(key))
        )
    })
    const queuedDescriptor = Cache.makeDescriptor("queued", "v1", keySchema, Schema.Number)
    const store = makeStore(
      () =>
        Deferred.succeed(readStarted, undefined).pipe(
          Effect.zipRight(Deferred.await(readGate)),
          Effect.as(Option.some("1"))
        ),
      () => Effect.void,
      () => Effect.void
    )
    const cache = yield* makeCache(store)
    const first = yield* Effect.fork(cache.get(queuedDescriptor, "key"))
    yield* Deferred.await(readStarted)
    const queued = yield* Effect.fork(cache.get(queuedDescriptor, "key"))
    yield* Deferred.await(secondKeyEncoded)
    yield* Effect.yieldNow()
    yield* Fiber.interruptFork(queued)
    const cancelled = yield* Fiber.await(queued).pipe(
      Effect.timeout("1 second"),
      Effect.fork
    )
    yield* TestClock.adjust("1 second")
    const cancelledExit = yield* Fiber.join(cancelled)

    yield* Deferred.succeed(readGate, undefined)
    expect(Exit.isInterrupted(cancelledExit)).toBe(true)
    expect(yield* Fiber.join(first)).toEqual(Option.some(1))
    yield* cache.set(queuedDescriptor, "key", 3)
    expect(yield* cache.get(queuedDescriptor, "key")).toEqual(Option.some(3))
  }))

it.scoped("allows a different key to resolve while another key is blocked", () =>
  Effect.gen(function*() {
    const readGate = yield* Deferred.make<void>()
    const readStarted = yield* Deferred.make<void>()
    const firstRead = yield* Ref.make(true)
    const store = makeStore(
      () =>
        Ref.getAndSet(firstRead, false).pipe(
          Effect.flatMap((first) =>
            Effect.if(first, {
              onTrue: () =>
                Deferred.succeed(readStarted, undefined).pipe(
                  Effect.zipRight(Deferred.await(readGate)),
                  Effect.as(Option.none<string>())
                ),
              onFalse: () => Effect.succeedSome("2")
            })
          )
        ),
      () => Effect.void,
      () => Effect.void
    )
    const cache = yield* makeCache(store)
    const blocked = yield* Effect.fork(
      cache.resolve(new Cache.SchemaCacheRequest({ descriptor, key: "blocked", compute: Effect.succeed(1) }))
    )
    yield* Deferred.await(readStarted)
    const progressing = yield* Effect.fork(
      cache.resolve(new Cache.SchemaCacheRequest({ descriptor, key: "other", compute: Effect.succeed(3) }))
    )
    const progressAwait = yield* Fiber.await(progressing).pipe(
      Effect.timeout("1 second"),
      Effect.fork
    )
    yield* TestClock.adjust("1 second")
    const progress = yield* Fiber.join(progressAwait)

    yield* Deferred.succeed(readGate, undefined)
    expect(progress).toEqual(Exit.succeed(Tuple.make(2, "hit")))
    expect(yield* Fiber.join(progressing)).toEqual(Tuple.make(2, "hit"))
    expect(yield* Fiber.join(blocked)).toEqual(Tuple.make(1, "miss"))
  }))

it.scoped("computes one miss for concurrent same-key resolutions", () =>
  Effect.gen(function*() {
    const computeGate = yield* Deferred.make<void>()
    const computeStarted = yield* Deferred.make<void>()
    const computes = yield* Ref.make(0)
    const backing = yield* Ref.make(Option.none<string>())
    const store = makeStore(
      () => Ref.get(backing),
      (_key, value) => Ref.set(backing, Option.some(value)),
      () => Ref.set(backing, Option.none())
    )
    const cache = yield* makeCache(store)
    const compute = Ref.update(computes, Num.increment).pipe(
      Effect.zipRight(Deferred.succeed(computeStarted, undefined)),
      Effect.zipRight(Deferred.await(computeGate)),
      Effect.as(5)
    )
    const request = new Cache.SchemaCacheRequest({ descriptor, key: "key", compute })
    const first = yield* Effect.fork(cache.resolve(request))
    yield* Deferred.await(computeStarted)
    const second = yield* Effect.fork(cache.resolve(request))
    yield* Effect.yieldNow()

    expect(yield* Ref.get(computes)).toBe(1)
    yield* Deferred.succeed(computeGate, undefined)
    expect(yield* Fiber.join(first)).toEqual(Tuple.make(5, "miss"))
    expect(yield* Fiber.join(second)).toEqual(Tuple.make(5, "hit"))
    expect(yield* Ref.get(computes)).toBe(1)
  }))

it.scoped("computes one miss when same-key resolutions acquire a cold lock simultaneously", () =>
  Effect.gen(function*() {
    const computes = yield* Ref.make(0)
    const cache = yield* Cache.SchemaCache
    const request = new Cache.SchemaCacheRequest({
      descriptor,
      key: "cold",
      compute: Ref.update(computes, Num.increment).pipe(Effect.zipRight(Effect.sleep("1 second")), Effect.as(41))
    })
    const resolving = yield* Effect.all(Arr.replicate(cache.resolve(request), 2), { concurrency: "unbounded" }).pipe(
      // Exercise cooperative yielding during cold lock acquisition.
      Effect.withMaxOpsBeforeYield(85),
      Effect.fork
    )
    yield* TestClock.adjust("1 second")
    const results = yield* Fiber.join(resolving)

    expect(yield* Ref.get(computes)).toBe(1)
    expect(Arr.map(results, ([value]) => value)).toEqual(Arr.make(41, 41))
    expect(Arr.sort(Arr.map(results, ([, resolution]) => resolution), Str.Order)).toEqual(Arr.make("hit", "miss"))
    expect(yield* cache.get(descriptor, "cold")).toEqual(Option.some(41))
  }).pipe(Effect.provide(Cache.SchemaCacheMemory)))

it.scoped("retries a failed backing lookup without advancing the clock", () =>
  Effect.gen(function*() {
    const attempts = yield* Ref.make(0)
    const store = makeStore(
      () =>
        Ref.updateAndGet(attempts, Num.increment).pipe(
          Effect.flatMap((attempt) =>
            Match.value(attempt).pipe(
              Match.when(1, () => Effect.fail(backendFailure("get"))),
              Match.orElse(() => Effect.succeedSome("3"))
            )
          )
        ),
      () => Effect.void,
      () => Effect.void
    )
    const cache = yield* makeCache(store)

    expect(yield* Effect.flip(cache.get(descriptor, "key"))).toMatchObject({
      _tag: "effect-search/CacheBackendError",
      operation: "get"
    })
    expect(yield* cache.get(descriptor, "key")).toEqual(Option.some(3))
    expect(yield* Ref.get(attempts)).toBe(2)
  }))

it.scoped("encodes the persistence key exactly once during resolve", () =>
  Effect.gen(function*() {
    const encodes = MutableRef.make(0)
    const keySchema = Schema.transform(Schema.String, Schema.String, {
      strict: true,
      decode: Str.toLowerCase,
      encode: (key) => {
        MutableRef.increment(encodes)
        return Str.toUpperCase(key)
      }
    })
    const keyed = Cache.makeDescriptor("once", "v1", keySchema, Schema.Number)
    const cache = yield* Cache.SchemaCache

    expect(
      yield* cache.resolve(
        new Cache.SchemaCacheRequest({ descriptor: keyed, key: "key", compute: Effect.succeed(8) })
      )
    ).toEqual(Tuple.make(8, "miss"))
    expect(MutableRef.get(encodes)).toBe(1)
  }).pipe(Effect.provide(Cache.SchemaCacheMemory)))
