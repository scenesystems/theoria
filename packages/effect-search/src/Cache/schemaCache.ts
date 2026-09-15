/**
 * Schema-encoded cache service with process-local lookup and per-key resolution locks.
 *
 * @since 0.1.0
 */
import * as PlatformError from "@effect/platform/Error"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as SqlClient from "@effect/sql/SqlClient"
import * as SqlSchema from "@effect/sql/SqlSchema"
import {
  Cache,
  Data,
  Effect,
  Exit,
  Inspectable,
  Layer,
  Option,
  ParseResult,
  RcMap,
  Schema,
  String as Str,
  Tuple
} from "effect"
import type * as Context from "effect/Context"
import type * as Scope from "effect/Scope"

import { type CacheDescriptor } from "./descriptor.js"
import { CacheBackendError, CacheCorrupt, type CacheError, type CacheResolutionSchema } from "./errors.js"
import { durableFingerprint } from "./fingerprint.js"

const LOOKUP_CACHE_CAPACITY = 1024
const LOOKUP_CACHE_TTL = "24 hours"
const SQLITE_CACHE_TABLE = "effect_search_cache_entries"

const cachePrefix = (namespace: string, version: string): string =>
  Str.concat(namespace, Str.concat(":", Str.concat(version, ":")))

const platformErrorFromCause = (operation: string) => (cause: unknown): PlatformError.PlatformError =>
  new PlatformError.SystemError({
    reason: "Unknown",
    module: "KeyValueStore",
    method: operation,
    description: Inspectable.toStringUnknown(cause),
    cause
  })

const cacheKey = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
  key: Key
): Effect.Effect<string, CacheCorrupt> =>
  Effect.suspend(() => Schema.encode(descriptor.keySchema)(key)).pipe(
    Effect.mapError((error) =>
      new CacheCorrupt({
        key: cachePrefix(descriptor.namespace, descriptor.version),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      durableFingerprint(encoded).pipe(
        Effect.map((fingerprint) => Str.concat(cachePrefix(descriptor.namespace, descriptor.version), fingerprint)),
        Effect.mapError((cause) =>
          new CacheCorrupt({
            key: cachePrefix(descriptor.namespace, descriptor.version),
            reason: Str.concat("fingerprint failure: ", cause._tag)
          })
        )
      )
    )
  )

const decodeValue = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
  key: string,
  encoded: string
): Effect.Effect<Value, CacheCorrupt> =>
  Schema.decode(Schema.parseJson(descriptor.valueSchema))(encoded).pipe(
    Effect.mapError((error) =>
      new CacheCorrupt({
        key,
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    )
  )

const encodeValue = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
  key: string,
  value: Value
): Effect.Effect<string, CacheCorrupt> =>
  Effect.suspend(() => Schema.encode(Schema.parseJson(descriptor.valueSchema))(value)).pipe(
    Effect.mapError((error) =>
      new CacheCorrupt({
        key,
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    )
  )

const failWithBackendError = (operation: string) => (cause: unknown): CacheBackendError =>
  new CacheBackendError({
    operation,
    reason: Inspectable.toStringUnknown(cause)
  })

/**
 * Couples a cache descriptor and decoded key with a lazy miss computation.
 *
 * @since 0.1.0
 * @category models
 */
export class SchemaCacheRequest<Key, Value, E, R, EncodedKey = Key, EncodedValue = Value> extends Data.Class<{
  /** Codecs and namespace used to persist the key and value. */
  readonly descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
  /** Decoded key whose encoded form determines cache identity. */
  readonly key: Key
  /** Computation evaluated only on a cache miss. */
  readonly compute: Effect.Effect<Value, E, R>
}> {}

/**
 * A resolved value paired with its stored or computed origin.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SchemaCacheResult<Value> = Schema.Schema.Type<
  Schema.Tuple2<Schema.Schema<Value>, typeof CacheResolutionSchema>
>

/**
 * Reads and writes typed values under canonical identities derived from encoded keys.
 *
 * @remarks
 * `get` decodes stored JSON. `set` persists encoded JSON before updating local lookup,
 * while `remove` removes the backing value before invalidating local lookup. `resolve`
 * returns `[value, "hit"]` for a decoded entry. On a miss it runs `compute`, persists
 * the value, and returns `[value, "miss"]`. A persistence failure after computation
 * fails the resolution instead of returning the computed value.
 *
 * Every lookup, mutation, and resolution of the same persistence key is serialized
 * within one service instance, including miss computation. Other keys progress
 * independently; other service instances and processes are not coordinated. Failed
 * backing lookups are immediately retryable. Failed or interrupted backing mutations
 * invalidate uncertain local state, while successful writes publish locally before
 * releasing the key. Schema and fingerprint failures use `CacheCorrupt`; backing-store
 * failures use `CacheBackendError`. Computation errors retain their original type and
 * are not cached.
 *
 * @since 0.1.0
 * @category services
 */
export class SchemaCache extends Effect.Tag("effect-search/Cache/SchemaCache")<
  SchemaCache,
  {
    /** Reads and decodes one entry, returning `None` when the key is absent. */
    readonly get: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<Option.Option<Value>, CacheError>
    /** Encodes and persists one value before updating the local lookup cache. */
    readonly set: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key,
      value: Value
    ) => Effect.Effect<void, CacheError>
    /** Deletes one persisted entry before invalidating its local lookup state. */
    readonly remove: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<void, CacheError>
    /** Returns a decoded hit or performs same-key serialized miss computation. */
    readonly resolve: <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>(
      args: SchemaCacheRequest<Key, Value, E, R, EncodedKey, EncodedValue>
    ) => Effect.Effect<SchemaCacheResult<Value>, CacheError | E, R>
  }
>() {}

/**
 * Implementation contract for schema cache lookup, mutation, and single-key resolution.
 * Generic computation errors and requirements flow through `resolve` unchanged.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SchemaCacheApi = Context.Tag.Service<typeof SchemaCache>

const makeLookupCache = (
  keyValueStore: KeyValueStore.KeyValueStore
): Effect.Effect<
  Cache.Cache<string, Option.Option<string>, CacheBackendError>,
  never,
  never
> =>
  Cache.make({
    capacity: LOOKUP_CACHE_CAPACITY,
    timeToLive: LOOKUP_CACHE_TTL,
    lookup: (key) =>
      keyValueStore.get(key).pipe(
        Effect.mapError(failWithBackendError("get"))
      )
  })

const makeSqliteKeyValueStore = (): Effect.Effect<
  KeyValueStore.KeyValueStore,
  PlatformError.PlatformError,
  SqlClient.SqlClient
> =>
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient
    const table = sql(SQLITE_CACHE_TABLE)

    yield* sql`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`.pipe(
      Effect.asVoid,
      Effect.mapError(platformErrorFromCause("sqlite-init"))
    )

    const findValue = SqlSchema.findOne({
      Request: Schema.String,
      Result: Schema.Struct({ value: Schema.String }).pipe(Schema.pluck("value")),
      execute: (key) => sql`SELECT value FROM ${table} WHERE key = ${key} LIMIT 1`
    })

    const get = (key: string): Effect.Effect<Option.Option<string>, PlatformError.PlatformError> =>
      findValue(key).pipe(Effect.mapError(platformErrorFromCause("get")))

    const set = (key: string, value: string): Effect.Effect<void, PlatformError.PlatformError> =>
      sql`INSERT INTO ${table} (key, value) VALUES (${key}, ${value}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        .pipe(
          Effect.asVoid,
          Effect.mapError(platformErrorFromCause("set"))
        )

    const remove = (key: string): Effect.Effect<void, PlatformError.PlatformError> =>
      sql`DELETE FROM ${table} WHERE key = ${key}`.pipe(
        Effect.asVoid,
        Effect.mapError(platformErrorFromCause("remove"))
      )

    const clear = sql`DELETE FROM ${table}`.pipe(
      Effect.asVoid,
      Effect.mapError(platformErrorFromCause("clear"))
    )

    const size = SqlSchema.single({
      Request: Schema.Void,
      Result: Schema.Struct({ count: Schema.NonNegativeInt }).pipe(Schema.pluck("count")),
      execute: () => sql`SELECT COUNT(*) AS count FROM ${table}`
    })(undefined).pipe(Effect.mapError(platformErrorFromCause("size")))

    return KeyValueStore.makeStringOnly({
      get,
      set,
      remove,
      clear,
      size
    })
  })

const sqlKeyValueStoreLayer = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
): Layer.Layer<KeyValueStore.KeyValueStore, CacheBackendError> =>
  Layer.scoped(
    KeyValueStore.KeyValueStore,
    makeSqliteKeyValueStore().pipe(
      Effect.mapError((error) =>
        new CacheBackendError({
          operation: "sql-key-value-store",
          reason: error.message
        })
      )
    )
  ).pipe(
    Layer.provide(sqlClientLayer),
    Layer.mapError((error) =>
      new CacheBackendError({
        operation: "sql-key-value-store-layer",
        reason: Inspectable.toStringUnknown(error)
      })
    )
  )

const resolveMiss = <Value, E, R>(
  compute: Effect.Effect<Value, E, R>,
  write: (value: Value) => Effect.Effect<void, CacheError>
): Effect.Effect<SchemaCacheResult<Value>, CacheError | E, R> =>
  compute.pipe(
    Effect.flatMap((computed) =>
      write(computed).pipe(
        Effect.as(Tuple.make(computed, "miss"))
      )
    )
  )

const resolveCached = <Value>(
  cachedOption: Option.Option<Value>
): Option.Option<SchemaCacheResult<Value>> => Option.map(cachedOption, (cached) => Tuple.make(cached, "hit"))

/**
 * Allocates local lookup and per-key locks over the required `KeyValueStore`.
 *
 * @remarks
 * Lookup retains up to 1,024 encoded hits or misses for 24 hours. Calls through this
 * service update or invalidate that local state; changes made directly to the backing
 * store or through another service may remain invisible until eviction or expiry. Failed
 * backing lookups are removed immediately instead of being retained by that TTL. An
 * uncertain failed or interrupted mutation invalidates local state; a successful write
 * publishes its encoded value locally before another same-key operation may begin.
 * Construction has no typed failure, requires `Scope`, and does not notify `CacheObserver`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeSchemaCache = (): Effect.Effect<SchemaCacheApi, never, KeyValueStore.KeyValueStore | Scope.Scope> =>
  Effect.gen(function*() {
    const keyValueStore = yield* KeyValueStore.KeyValueStore
    const lookupCache = yield* makeLookupCache(keyValueStore)
    const perKeySemaphores = yield* RcMap.make({
      lookup: (_resolvedKey: string) => Effect.makeSemaphore(1)
    })
    const registrySemaphore = yield* Effect.makeSemaphore(1)

    const withResolvedKeyLock = <A, E, R>(
      resolvedKey: string,
      operation: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E, R> =>
      // Serialize cold RcMap acquisition, not the independent per-key operations.
      registrySemaphore.withPermits(1)(RcMap.get(perKeySemaphores, resolvedKey)).pipe(
        Effect.flatMap((semaphore) => semaphore.withPermits(1)(operation)),
        Effect.scoped
      )

    const readResolved = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      resolvedKey: string
    ): Effect.Effect<Option.Option<Value>, CacheError> =>
      lookupCache.get(resolvedKey).pipe(
        Effect.onError(() => lookupCache.invalidate(resolvedKey)),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeedNone,
            onSome: (encoded) => decodeValue(descriptor, resolvedKey, encoded).pipe(Effect.asSome)
          })
        )
      )

    const writeResolved = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      resolvedKey: string,
      value: Value
    ): Effect.Effect<void, CacheError> =>
      encodeValue(descriptor, resolvedKey, value).pipe(
        Effect.flatMap((encoded) =>
          Effect.uninterruptibleMask((restore) =>
            restore(keyValueStore.set(resolvedKey, encoded).pipe(Effect.mapError(failWithBackendError("set")))).pipe(
              Effect.onExit(
                Exit.match({
                  onFailure: () => lookupCache.invalidate(resolvedKey),
                  onSuccess: () => lookupCache.set(resolvedKey, Option.some(encoded))
                })
              )
            )
          )
        )
      )

    const removeResolved = (resolvedKey: string): Effect.Effect<void, CacheError> =>
      Effect.uninterruptibleMask((restore) =>
        restore(keyValueStore.remove(resolvedKey).pipe(Effect.mapError(failWithBackendError("remove")))).pipe(
          Effect.onExit(() => lookupCache.invalidate(resolvedKey))
        )
      )

    const get = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ): Effect.Effect<Option.Option<Value>, CacheError> =>
      cacheKey(descriptor, key).pipe(
        Effect.flatMap((resolvedKey) => withResolvedKeyLock(resolvedKey, readResolved(descriptor, resolvedKey)))
      )

    const set = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key,
      value: Value
    ): Effect.Effect<void, CacheError> =>
      cacheKey(descriptor, key).pipe(
        Effect.flatMap((resolvedKey) => withResolvedKeyLock(resolvedKey, writeResolved(descriptor, resolvedKey, value)))
      )

    const remove = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ): Effect.Effect<void, CacheError> =>
      cacheKey(descriptor, key).pipe(
        Effect.flatMap((resolvedKey) => withResolvedKeyLock(resolvedKey, removeResolved(resolvedKey)))
      )

    const resolve = <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>(
      args: SchemaCacheRequest<Key, Value, E, R, EncodedKey, EncodedValue>
    ): Effect.Effect<SchemaCacheResult<Value>, CacheError | E, R> =>
      cacheKey(args.descriptor, args.key).pipe(
        Effect.flatMap((resolvedKey) =>
          withResolvedKeyLock(
            resolvedKey,
            readResolved(args.descriptor, resolvedKey).pipe(
              Effect.flatMap((cachedOption): Effect.Effect<SchemaCacheResult<Value>, CacheError | E, R> =>
                Option.match(resolveCached(cachedOption), {
                  onNone: () =>
                    resolveMiss(args.compute, (computed) => writeResolved(args.descriptor, resolvedKey, computed)),
                  onSome: Effect.succeed
                })
              )
            )
          )
        )
      )

    return {
      get,
      set,
      remove,
      resolve
    }
  })

/**
 * Builds one {@link SchemaCache} over the required key-value store.
 * Each Layer instance owns its lookup entries and scoped, reference-counted per-key locks.
 *
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheLive = Layer.scoped(SchemaCache, makeSchemaCache())

/**
 * Stores cache entries and lookup state in the current process only.
 * A fresh Layer instance starts empty and has no requirements or typed acquisition failure.
 *
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheMemory = Layer.provide(SchemaCacheLive, KeyValueStore.layerMemory)

/**
 * Persists cache entries through the platform filesystem store rooted at `directory`.
 *
 * @remarks
 * The Layer requires platform filesystem and path services. Their acquisition or I/O
 * errors remain platform errors; cache operations translate backing-store errors to
 * `CacheBackendError`. Process-local lookup is not shared across Layer instances.
 *
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheFileSystem = (directory: string) =>
  Layer.provide(SchemaCacheLive, KeyValueStore.layerFileSystem(directory))

/**
 * Persists entries in the `effect_search_cache_entries` table using a supplied SQL client Layer.
 *
 * @remarks
 * Layer construction creates the table when absent and may fail with `CacheBackendError`.
 * The statements use SQLite-compatible `ON CONFLICT` syntax. The supplied Layer's resource
 * lifecycle is retained, while cache lookup and same-key locking remain process-local.
 *
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
) => Layer.provide(SchemaCacheLive, sqlKeyValueStoreLayer(sqlClientLayer))
