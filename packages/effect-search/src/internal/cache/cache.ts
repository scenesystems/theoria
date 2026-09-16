import * as PlatformError from "@effect/platform/Error"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as SqlClient from "@effect/sql/SqlClient"
import * as SqlSchema from "@effect/sql/SqlSchema"
import {
  Cache as LookupCache,
  Effect,
  Exit,
  Inspectable,
  Layer,
  Option,
  ParseResult,
  RcMap,
  Schema,
  String as Str
} from "effect"
import type * as Scope from "effect/Scope"

import { durableFingerprint } from "@scenesystems/digest"
import {
  BackendError,
  Corrupt,
  type Error as CacheError,
  type KeySpace,
  type Request,
  Result,
  type Service
} from "../../Cache.js"

const lookupCacheCapacity = 1024
const lookupCacheTtl = "24 hours"
const sqliteCacheTable = "effect_search_cache_entries"

const keyPrefix = (namespace: string, version: string): string =>
  Str.concat(namespace, Str.concat(":", Str.concat(version, ":")))

const platformErrorFromCause = (operation: string) => (cause: unknown): PlatformError.PlatformError =>
  new PlatformError.SystemError({
    reason: "Unknown",
    module: "KeyValueStore",
    method: operation,
    description: Inspectable.toStringUnknown(cause),
    cause
  })

const resolvedKey = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
  key: Key
): Effect.Effect<string, Corrupt> =>
  Effect.suspend(() => Schema.encode(keySpace.keySchema)(key)).pipe(
    Effect.mapError((error) =>
      new Corrupt({
        key: keyPrefix(keySpace.namespace, keySpace.version),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      durableFingerprint(encoded).pipe(
        Effect.map((fingerprint) => Str.concat(keyPrefix(keySpace.namespace, keySpace.version), fingerprint)),
        Effect.mapError((cause) =>
          new Corrupt({
            key: keyPrefix(keySpace.namespace, keySpace.version),
            reason: Str.concat("fingerprint failure: ", cause._tag)
          })
        )
      )
    )
  )

const decodeValue = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
  key: string,
  encoded: string
): Effect.Effect<Value, Corrupt> =>
  Schema.decode(Schema.parseJson(keySpace.valueSchema))(encoded).pipe(
    Effect.mapError((error) =>
      new Corrupt({
        key,
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    )
  )

const encodeValue = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
  key: string,
  value: Value
): Effect.Effect<string, Corrupt> =>
  Effect.suspend(() => Schema.encode(Schema.parseJson(keySpace.valueSchema))(value)).pipe(
    Effect.mapError((error) =>
      new Corrupt({
        key,
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    )
  )

const backendError = (operation: string) => (cause: unknown): BackendError =>
  new BackendError({ operation, reason: Inspectable.toStringUnknown(cause) })

const makeLookupCache = (
  keyValueStore: KeyValueStore.KeyValueStore
): Effect.Effect<LookupCache.Cache<string, Option.Option<string>, BackendError>> =>
  LookupCache.make({
    capacity: lookupCacheCapacity,
    timeToLive: lookupCacheTtl,
    lookup: (key) => keyValueStore.get(key).pipe(Effect.mapError(backendError("get")))
  })

const makeSqliteKeyValueStore = (): Effect.Effect<
  KeyValueStore.KeyValueStore,
  PlatformError.PlatformError,
  SqlClient.SqlClient
> =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient
    const table = sql(sqliteCacheTable)

    yield* sql`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`.pipe(
      Effect.asVoid,
      Effect.mapError(platformErrorFromCause("sqlite-init"))
    )

    const findValue = SqlSchema.findOne({
      Request: Schema.String,
      Result: Schema.Struct({ value: Schema.String }).pipe(Schema.pluck("value")),
      execute: (key) => sql`SELECT value FROM ${table} WHERE key = ${key} LIMIT 1`
    })

    return KeyValueStore.makeStringOnly({
      get: (key) => findValue(key).pipe(Effect.mapError(platformErrorFromCause("get"))),
      set: (key, value) =>
        sql`INSERT INTO ${table} (key, value) VALUES (${key}, ${value}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
          .pipe(Effect.asVoid, Effect.mapError(platformErrorFromCause("set"))),
      remove: (key) =>
        sql`DELETE FROM ${table} WHERE key = ${key}`.pipe(
          Effect.asVoid,
          Effect.mapError(platformErrorFromCause("remove"))
        ),
      clear: sql`DELETE FROM ${table}`.pipe(
        Effect.asVoid,
        Effect.mapError(platformErrorFromCause("clear"))
      ),
      size: SqlSchema.single({
        Request: Schema.Void,
        Result: Schema.Struct({ count: Schema.NonNegativeInt }).pipe(Schema.pluck("count")),
        execute: () => sql`SELECT COUNT(*) AS count FROM ${table}`
      })(undefined).pipe(Effect.mapError(platformErrorFromCause("size")))
    })
  })

export const sqlKeyValueStoreLayer = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, BackendError>
): Layer.Layer<KeyValueStore.KeyValueStore, BackendError> =>
  Layer.scoped(
    KeyValueStore.KeyValueStore,
    makeSqliteKeyValueStore().pipe(
      Effect.mapError((error) => new BackendError({ operation: "sql-key-value-store", reason: error.message }))
    )
  ).pipe(
    Layer.provide(sqlClientLayer),
    Layer.mapError((error) =>
      new BackendError({
        operation: "sql-key-value-store-layer",
        reason: Inspectable.toStringUnknown(error)
      })
    )
  )

const resolveMiss = <Value, ComputeError, Requirements>(
  compute: Effect.Effect<Value, ComputeError, Requirements>,
  write: (value: Value) => Effect.Effect<void, CacheError>
): Effect.Effect<Result<Value>, CacheError | ComputeError, Requirements> =>
  compute.pipe(
    Effect.flatMap((value) => write(value).pipe(Effect.as(new Result({ value, resolution: "miss" }))))
  )

const resolveCached = <Value>(cached: Option.Option<Value>): Option.Option<Result<Value>> =>
  Option.map(cached, (value) => new Result({ value, resolution: "hit" }))

export const make = (): Effect.Effect<Service, never, KeyValueStore.KeyValueStore | Scope.Scope> =>
  Effect.gen(function*() {
    const keyValueStore = yield* KeyValueStore.KeyValueStore
    const lookupCache = yield* makeLookupCache(keyValueStore)
    const perKeySemaphores = yield* RcMap.make({
      lookup: (_key: string) => Effect.makeSemaphore(1)
    })
    const registrySemaphore = yield* Effect.makeSemaphore(1)

    const withKeyLock = <A, E, R>(key: string, operation: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
      registrySemaphore.withPermits(1)(RcMap.get(perKeySemaphores, key)).pipe(
        Effect.flatMap((semaphore) => semaphore.withPermits(1)(operation)),
        Effect.scoped
      )

    const readResolved = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
      key: string
    ): Effect.Effect<Option.Option<Value>, CacheError> =>
      lookupCache.get(key).pipe(
        Effect.onError(() => lookupCache.invalidate(key)),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeedNone,
            onSome: (encoded) => decodeValue(keySpace, key, encoded).pipe(Effect.asSome)
          })
        )
      )

    const writeResolved = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      keySpace: KeySpace<Key, Value, EncodedKey, EncodedValue>,
      key: string,
      value: Value
    ): Effect.Effect<void, CacheError> =>
      encodeValue(keySpace, key, value).pipe(
        Effect.flatMap((encoded) =>
          Effect.uninterruptibleMask((restore) =>
            restore(keyValueStore.set(key, encoded).pipe(Effect.mapError(backendError("set")))).pipe(
              Effect.onExit(
                Exit.match({
                  onFailure: () => lookupCache.invalidate(key),
                  onSuccess: () => lookupCache.set(key, Option.some(encoded))
                })
              )
            )
          )
        )
      )

    const removeResolved = (key: string): Effect.Effect<void, CacheError> =>
      Effect.uninterruptibleMask((restore) =>
        restore(keyValueStore.remove(key).pipe(Effect.mapError(backendError("remove")))).pipe(
          Effect.onExit(() => lookupCache.invalidate(key))
        )
      )

    const get: Service["get"] = (keySpace, key) =>
      resolvedKey(keySpace, key).pipe(
        Effect.flatMap((resolved) => withKeyLock(resolved, readResolved(keySpace, resolved)))
      )

    const set: Service["set"] = (keySpace, key, value) =>
      resolvedKey(keySpace, key).pipe(
        Effect.flatMap((resolved) => withKeyLock(resolved, writeResolved(keySpace, resolved, value)))
      )

    const remove: Service["remove"] = (keySpace, key) =>
      resolvedKey(keySpace, key).pipe(
        Effect.flatMap((resolved) => withKeyLock(resolved, removeResolved(resolved)))
      )

    const resolve: Service["resolve"] = <
      Key,
      Value,
      ComputeError,
      Requirements,
      EncodedKey = Key,
      EncodedValue = Value
    >(
      request: Request<Key, Value, ComputeError, Requirements, EncodedKey, EncodedValue>
    ): Effect.Effect<Result<Value>, CacheError | ComputeError, Requirements> =>
      resolvedKey(request.keySpace, request.key).pipe(
        Effect.flatMap((resolved) =>
          withKeyLock(
            resolved,
            readResolved(request.keySpace, resolved).pipe(
              Effect.flatMap((cached): Effect.Effect<Result<Value>, CacheError | ComputeError, Requirements> =>
                Option.match(resolveCached(cached), {
                  onNone: () =>
                    resolveMiss(request.compute, (value) => writeResolved(request.keySpace, resolved, value)),
                  onSome: Effect.succeed
                })
              )
            )
          )
        )
      )

    return { get, set, remove, resolve }
  })
