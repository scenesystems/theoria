/**
 * Schema-parameterized shared cache authority.
 *
 * @since 0.1.0
 */
import * as PlatformError from "@effect/platform/Error"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as SqlClient from "@effect/sql/SqlClient"
import { Cache, Effect, Layer, Option, ParseResult, PartitionedSemaphore, Schema, Tuple } from "effect"
import type * as Context from "effect/Context"

import { type CacheDescriptor } from "./descriptor.js"
import { CacheBackendError, CacheCorrupt, type CacheError, type CacheResolution } from "./errors.js"
import { durableFingerprint } from "./fingerprint.js"

const LOOKUP_CACHE_CAPACITY = 1024
const LOOKUP_CACHE_TTL = "24 hours"
const SQLITE_CACHE_TABLE = "effect_search_cache_entries"

const cachePrefix = (namespace: string, version: string): string => `${namespace}:${version}:`

const platformErrorFromCause = (operation: string) => (cause: unknown): PlatformError.PlatformError =>
  new PlatformError.SystemError({
    reason: "Unknown",
    module: "KeyValueStore",
    method: operation,
    description: String(cause),
    cause
  })

const cacheKey = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
  descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
  key: Key
): Effect.Effect<string, CacheCorrupt> =>
  Schema.encode(descriptor.keySchema)(key).pipe(
    Effect.mapError((error) =>
      new CacheCorrupt({
        key: cachePrefix(descriptor.namespace, descriptor.version),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      durableFingerprint(encoded).pipe(
        Effect.map((fingerprint) => `${cachePrefix(descriptor.namespace, descriptor.version)}${fingerprint}`),
        Effect.mapError((cause) =>
          new CacheCorrupt({
            key: cachePrefix(descriptor.namespace, descriptor.version),
            reason: `fingerprint failure: ${String(cause)}`
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
  Schema.encode(Schema.parseJson(descriptor.valueSchema))(value).pipe(
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
    reason: String(cause)
  })

/**
 * @since 0.1.0
 * @category services
 */
export class SchemaCache extends Effect.Tag("effect-search/Cache/SchemaCache")<
  SchemaCache,
  {
    readonly get: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<Option.Option<Value>, CacheError>
    readonly set: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key,
      value: Value
    ) => Effect.Effect<void, CacheError>
    readonly remove: <Key, Value, EncodedKey = Key, EncodedValue = Value>(
      descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
      key: Key
    ) => Effect.Effect<void, CacheError>
    readonly resolve: <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>(args: {
      readonly descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
      readonly key: Key
      readonly compute: Effect.Effect<Value, E, R>
    }) => Effect.Effect<readonly [Value, CacheResolution], CacheError | E, R>
  }
>() {
  /**
   * Allocate the shared schema-parameterized cache service from a key-value-store boundary.
   *
   * @since 0.1.0
   * @category constructors
   */
  static allocate(): Effect.Effect<SchemaCacheApi, never, KeyValueStore.KeyValueStore> {
    return Effect.gen(function*() {
      const keyValueStore = yield* KeyValueStore.KeyValueStore
      const lookupCache = yield* makeLookupCache(keyValueStore)
      const perKeySemaphore = yield* PartitionedSemaphore.make<string>({ permits: 1 })

      const get = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
        descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
        key: Key
      ): Effect.Effect<Option.Option<Value>, CacheError> =>
        cacheKey(descriptor, key).pipe(
          Effect.flatMap((resolvedKey) =>
            lookupCache.get(resolvedKey).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.succeed(Option.none()),
                  onSome: (encoded) => decodeValue(descriptor, resolvedKey, encoded).pipe(Effect.map(Option.some))
                })
              )
            )
          )
        )

      const set = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
        descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
        key: Key,
        value: Value
      ): Effect.Effect<void, CacheError> =>
        cacheKey(descriptor, key).pipe(
          Effect.flatMap((resolvedKey) =>
            encodeValue(descriptor, resolvedKey, value).pipe(
              Effect.flatMap((encoded) =>
                keyValueStore.set(resolvedKey, encoded).pipe(
                  Effect.mapError(failWithBackendError("set")),
                  Effect.zipRight(lookupCache.set(resolvedKey, Option.some(encoded)))
                )
              )
            )
          )
        )

      const remove = <Key, Value, EncodedKey = Key, EncodedValue = Value>(
        descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
        key: Key
      ): Effect.Effect<void, CacheError> =>
        cacheKey(descriptor, key).pipe(
          Effect.flatMap((resolvedKey) =>
            keyValueStore.remove(resolvedKey).pipe(
              Effect.mapError(failWithBackendError("remove")),
              Effect.zipRight(lookupCache.invalidate(resolvedKey))
            )
          )
        )

      const resolveWithSingleFlight = <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>(args: {
        readonly descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
        readonly key: Key
        readonly compute: Effect.Effect<Value, E, R>
      }): Effect.Effect<readonly [Value, CacheResolution], CacheError | E, R> =>
        cacheKey(args.descriptor, args.key).pipe(
          Effect.flatMap((resolvedKey) =>
            perKeySemaphore.withPermits(resolvedKey, 1)(
              get(args.descriptor, args.key).pipe(
                Effect.flatMap((cachedOption): Effect.Effect<readonly [Value, CacheResolution], CacheError | E, R> =>
                  Option.match(resolveCached(cachedOption), {
                    onNone: () => resolveMiss(args.descriptor, args.key, args.compute, set),
                    onSome: Effect.succeed
                  })
                )
              )
            )
          )
        )

      const resolve = <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>({
        descriptor,
        key,
        compute
      }: {
        readonly descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>
        readonly key: Key
        readonly compute: Effect.Effect<Value, E, R>
      }): Effect.Effect<readonly [Value, CacheResolution], CacheError | E, R> =>
        resolveWithSingleFlight({ descriptor, key, compute })

      return {
        get,
        set,
        remove,
        resolve
      }
    })
  }
}

/**
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

    const get = (key: string): Effect.Effect<Option.Option<string>, PlatformError.PlatformError> =>
      sql<{ readonly value: string }>`SELECT value FROM ${table} WHERE key = ${key} LIMIT 1`.pipe(
        Effect.map((rows) =>
          Option.fromNullable(rows[0]).pipe(
            Option.map((row) => row.value)
          )
        ),
        Effect.mapError(platformErrorFromCause("get"))
      )

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

    const size = sql<{ readonly count: number }>`SELECT COUNT(*) AS count FROM ${table}`.pipe(
      Effect.map((rows) =>
        Option.fromNullable(rows[0]).pipe(
          Option.map((row) => row.count),
          Option.getOrElse(() => 0)
        )
      ),
      Effect.mapError(platformErrorFromCause("size"))
    )

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
        reason: String(error)
      })
    )
  )

const resolveMiss = <Key, Value, E, R, EncodedKey = Key, EncodedValue = Value>(
  descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
  key: Key,
  compute: Effect.Effect<Value, E, R>,
  set: (
    descriptor: CacheDescriptor<Key, Value, EncodedKey, EncodedValue>,
    key: Key,
    value: Value
  ) => Effect.Effect<void, CacheError>
): Effect.Effect<readonly [Value, CacheResolution], CacheError | E, R> =>
  compute.pipe(
    Effect.flatMap((computed) =>
      set(descriptor, key, computed).pipe(
        Effect.as(Tuple.make(computed, "miss"))
      )
    )
  )

const resolveCached = <Value>(
  cachedOption: Option.Option<Value>
): Option.Option<readonly [Value, CacheResolution]> => Option.map(cachedOption, (cached) => Tuple.make(cached, "hit"))

/**
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheLive = Layer.effect(SchemaCache, SchemaCache.allocate())

/**
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheMemory = Layer.provide(SchemaCacheLive, KeyValueStore.layerMemory)

/**
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheFileSystem = (directory: string) =>
  Layer.provide(SchemaCacheLive, KeyValueStore.layerFileSystem(directory))

/**
 * SQLite-compatible SQL-backed shared cache layer. Accepts a `SqlClient`
 * layer from the consumer so callers can choose the runtime integration,
 * while the cache SQL itself remains pinned to the SQLite-compatible dialect
 * used by the shared key-value store implementation.
 *
 * @since 0.1.0
 * @category layers
 */
export const SchemaCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
) => Layer.provide(SchemaCacheLive, sqlKeyValueStoreLayer(sqlClientLayer))
