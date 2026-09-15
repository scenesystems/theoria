/**
 * Caches objective values by canonical configuration identity.
 *
 * @since 0.1.0
 */
import type * as SqlClient from "@effect/sql/SqlClient"
import { Data, Effect, Layer, Match, Option, ParseResult, Schema, String as Str, Tuple } from "effect"
import type * as Context from "effect/Context"

import * as Cache from "../Cache/index.js"
import type { CacheObservabilityEvent } from "../Cache/observer.js"
import { CacheObserver } from "../Cache/observer.js"
import { type ObjectiveValue, ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"

const DEFAULT_SCOPE = "study"

/**
 * Selects the cache namespace used for objective values.
 *
 * @remarks
 * The scope is retained as supplied and is not an access-control boundary.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyObjectiveCacheOptions extends Data.Class<{
  /** Prefix used before the fixed `/objective` descriptor namespace. */
  readonly scope: string
}> {}

/**
 * Couples a configuration schema and decoded value with a lazy objective computation.
 *
 * @typeParam A - Decoded configuration accepted by the objective.
 * @typeParam I - Encoded configuration fingerprinted by the cache.
 * @typeParam E - Objective computation error.
 * @typeParam R - Objective computation requirements.
 * @since 0.1.0
 * @category models
 */
export class StudyObjectiveCacheRequest<A, I, E, R> extends Data.Class<{
  /** Schema defining both the objective configuration and its persisted identity. */
  readonly schema: Schema.Schema<A, I, never>
  /** Decoded configuration supplied to the objective. */
  readonly config: A
  /** Evaluation run only after lookup misses. */
  readonly compute: Effect.Effect<ObjectiveValue, E, R>
}> {}

const DEFAULT_OPTIONS = new StudyObjectiveCacheOptions({ scope: DEFAULT_SCOPE })

/**
 * Uses a caller-selected namespace for objective cache entries.
 *
 * @since 0.1.0
 * @category constructors
 */
export const studyObjectiveCacheOptions = (scope: string): StudyObjectiveCacheOptions =>
  new StudyObjectiveCacheOptions({ scope })

const descriptorFor = <A, I>(
  options: StudyObjectiveCacheOptions,
  schema: Schema.Schema<A, I, never>
): Cache.CacheDescriptor<I, ObjectiveValue, I> =>
  Cache.makeDescriptor(
    Str.concat(options.scope, "/objective"),
    "v1",
    Schema.encodedSchema(schema),
    ObjectiveValueSchema
  )

const descriptorPrefix = <I>(descriptor: Cache.CacheDescriptor<I, ObjectiveValue, I>): string =>
  Str.concat(descriptor.namespace, Str.concat(":", Str.concat(descriptor.version, ":")))

const prepareKey = <A, I>(
  options: StudyObjectiveCacheOptions,
  schema: Schema.Schema<A, I, never>,
  config: A
) => {
  const descriptor = descriptorFor(options, schema)
  return Effect.suspend(() => Schema.encode(schema)(config)).pipe(
    Effect.mapError((error) =>
      new Cache.CacheCorrupt({
        key: descriptorPrefix(descriptor),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      Cache.durableFingerprint(encoded).pipe(
        Effect.map((fingerprint) => Tuple.make(descriptor, encoded, fingerprint)),
        Effect.mapError((cause) =>
          new Cache.CacheCorrupt({
            key: descriptorPrefix(descriptor),
            reason: Str.concat("fingerprint failure: ", cause._tag)
          })
        )
      )
    )
  )
}

/**
 * Reuses objective values for configurations with the same canonical JSON identity.
 *
 * @remarks
 * The caller's schema encodes each configuration exactly once. Its encoded schema
 * then identifies that encoded representation to the underlying schema cache, so
 * transformed configurations are fingerprinted by their wire preimage without a
 * second transform. Resolution serializes concurrent computation of the same key
 * within one cache service. A successful miss is cached; computation failures are
 * returned unchanged and are not cached. Key encoding, value encoding, and backend
 * failures use the cache error channel.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyObjectiveCache extends Effect.Tag("effect-search/Study/StudyObjectiveCache")<
  StudyObjectiveCache,
  {
    /**
     * Reads a cached value or runs `compute` once for a missing configuration.
     * The tuple identifies whether the returned value was a `hit` or `miss`.
     */
    readonly resolve: <A, I, E, R>(
      request: StudyObjectiveCacheRequest<A, I, E, R>
    ) => Effect.Effect<Cache.SchemaCacheResult<ObjectiveValue>, Cache.CacheError | E, R>
    /** Removes the entry for a schema-defined decoded configuration, if present. */
    readonly invalidate: <A, I>(
      schema: Schema.Schema<A, I, never>,
      config: A
    ) => Effect.Effect<void, Cache.CacheError>
  }
>() {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyObjectiveCacheError = Cache.CacheError

/**
 * Describes the operations implemented by the {@link StudyObjectiveCache} service.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StudyObjectiveCacheApi = Context.Tag.Service<typeof StudyObjectiveCache>

/**
 * Creates an objective cache over the required schema-cache service.
 *
 * @remarks
 * A {@link CacheObserver} present during construction receives hit, miss, and
 * invalidation events with the configured scope and canonical fingerprint. The
 * observer is optional. Observer interruption or defects propagate from the cache
 * operation that records the event.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeStudyObjectiveCache = (
  options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS
): Effect.Effect<StudyObjectiveCacheApi, never, Cache.SchemaCache> =>
  Effect.gen(function*() {
    const schemaCache = yield* Cache.SchemaCache
    const observerOption = yield* Effect.serviceOption(CacheObserver)

    const emitObservation = (event: CacheObservabilityEvent): Effect.Effect<void> =>
      Option.match(observerOption, {
        onNone: () => Effect.void,
        onSome: (observer) => observer.record(event)
      })

    return {
      resolve: ({ schema, config, compute }) =>
        prepareKey(options, schema, config).pipe(
          Effect.flatMap(([descriptor, encoded, fingerprint]) =>
            schemaCache.resolve({
              descriptor,
              key: encoded,
              compute
            }).pipe(
              Effect.tap(([, resolution]) =>
                emitObservation(
                  Match.value(resolution).pipe(
                    Match.when("hit", () => Cache.CacheHit({ fingerprint, scope: options.scope })),
                    Match.when("miss", () => Cache.CacheMiss({ fingerprint, scope: options.scope })),
                    Match.exhaustive
                  )
                )
              )
            )
          )
        ),
      invalidate: (schema, config) =>
        prepareKey(options, schema, config).pipe(
          Effect.flatMap(([descriptor, encoded, fingerprint]) =>
            schemaCache.remove(descriptor, encoded).pipe(
              Effect.tap(() => emitObservation(Cache.CacheInvalidation({ fingerprint, scope: options.scope })))
            )
          )
        )
    }
  })

/**
 * Builds one objective-cache service over a required {@link Cache.SchemaCache}.
 *
 * @remarks
 * The Layer has no typed acquisition failure or release action. Lookup state,
 * per-key serialization, and persistence behavior belong to the supplied schema cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheLive = (options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS) =>
  Layer.effect(StudyObjectiveCache, makeStudyObjectiveCache(options))

/**
 * Stores objective values for the lifetime of one in-memory Layer instance.
 *
 * @remarks
 * A fresh Layer starts empty and has no requirements. Its schema cache owns scoped per-key locks.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheMemory = (options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS) =>
  StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheMemory))

/**
 * Persists objective values in a platform filesystem store rooted at `directory`.
 *
 * @remarks
 * The Layer requires platform filesystem and path services. Cache operations report
 * backing-store failures as `CacheBackendError`; process-local lookup and same-key
 * serialization are not shared with other Layer instances.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheFileSystem = (
  directory: string,
  options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS
) => StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheFileSystem(directory)))

/**
 * Persists objective values through a supplied SQLite-compatible SQL client Layer.
 *
 * @remarks
 * Layer construction creates the cache table when absent and may fail with
 * `CacheBackendError`. The supplied client Layer controls connection acquisition
 * and release. Lookup and same-key serialization remain process-local.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, Cache.CacheBackendError>,
  options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS
) => StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheSql(sqlClientLayer)))
