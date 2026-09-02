/**
 * Caches objective values by canonical configuration identity.
 *
 * @since 0.1.0
 */
import type * as SqlClient from "@effect/sql/SqlClient"
import { Data, Effect, Layer, Option, ParseResult, Schema } from "effect"
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
 * Deterministic key shape accepted by StudyObjectiveCache.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StudyObjectiveCacheKey =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<StudyObjectiveCacheKey>
  | { readonly [key: string]: StudyObjectiveCacheKey }

const StudyObjectiveCacheKeyPrimitiveSchema = Schema.Union(
  Schema.String,
  Schema.JsonNumber,
  Schema.Boolean,
  Schema.Null
)

const StudyObjectiveCacheKeySchema: Schema.Schema<StudyObjectiveCacheKey> = Schema.Union(
  StudyObjectiveCacheKeyPrimitiveSchema,
  Schema.Array(Schema.suspend(() => StudyObjectiveCacheKeySchema)),
  Schema.Record({
    key: Schema.String,
    value: Schema.suspend(() => StudyObjectiveCacheKeySchema)
  })
)

const DEFAULT_OPTIONS = new StudyObjectiveCacheOptions({ scope: DEFAULT_SCOPE })

/**
 * Uses a caller-selected namespace for objective cache entries.
 *
 * @since 0.1.0
 * @category constructors
 */
export const studyObjectiveCacheOptions = (scope: string): StudyObjectiveCacheOptions =>
  new StudyObjectiveCacheOptions({ scope })

const descriptorFor = (options: StudyObjectiveCacheOptions) =>
  Cache.makeDescriptor(`${options.scope}/objective`, "v1", StudyObjectiveCacheKeySchema, ObjectiveValueSchema)

const descriptorPrefix = (descriptor: Cache.CacheDescriptor<StudyObjectiveCacheKey, ObjectiveValue>): string =>
  `${descriptor.namespace}:${descriptor.version}:`

const prepareKey = (
  descriptor: Cache.CacheDescriptor<StudyObjectiveCacheKey, ObjectiveValue>,
  config: unknown
): Effect.Effect<{
  readonly encoded: StudyObjectiveCacheKey
  readonly fingerprint: string
}, Cache.CacheCorrupt> =>
  Schema.encodeUnknown(descriptor.keySchema)(config).pipe(
    Effect.mapError((error) =>
      new Cache.CacheCorrupt({
        key: descriptorPrefix(descriptor),
        reason: ParseResult.TreeFormatter.formatIssueSync(error.issue)
      })
    ),
    Effect.flatMap((encoded) =>
      Cache.durableFingerprint(encoded).pipe(
        Effect.map((fingerprint) => ({ encoded, fingerprint })),
        Effect.mapError((cause) =>
          new Cache.CacheCorrupt({
            key: descriptorPrefix(descriptor),
            reason: `fingerprint failure: ${cause._tag}`
          })
        )
      )
    )
  )

/**
 * Reuses objective values for configurations with the same canonical JSON identity.
 *
 * @remarks
 * Configurations are validated as recursive JSON values before lookup. Resolution
 * serializes concurrent computation of the same key within one cache service. A
 * successful miss is cached; computation failures are returned unchanged and are
 * not cached. Key encoding, value encoding, and backend failures use the cache
 * error channel.
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
    readonly resolve: <E, Requirement>(args: {
      /** JSON-safe configuration used as the canonical cache key. */
      readonly config: unknown
      /** Evaluation run only after lookup misses; its errors and requirements are preserved. */
      readonly compute: Effect.Effect<ObjectiveValue, E, Requirement>
    }) => Effect.Effect<readonly [ObjectiveValue, Cache.CacheResolution], Cache.CacheError | E, Requirement>
    /** Removes the entry for a JSON-safe configuration, if present. */
    readonly invalidate: (config: unknown) => Effect.Effect<void, Cache.CacheError>
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
    const descriptor = descriptorFor(options)
    const observerOption = yield* Effect.serviceOption(CacheObserver)

    const emitObservation = (event: CacheObservabilityEvent): Effect.Effect<void> =>
      Option.match(observerOption, {
        onNone: () => Effect.void,
        onSome: (observer) => observer.record(event)
      })

    return {
      resolve: ({ config, compute }) =>
        prepareKey(descriptor, config).pipe(
          Effect.flatMap(({ encoded, fingerprint }) =>
            schemaCache.resolve({
              descriptor,
              key: encoded,
              compute
            }).pipe(
              Effect.tap(([, resolution]) =>
                emitObservation(
                  resolution === "hit"
                    ? { _tag: "Hit", fingerprint, scope: options.scope }
                    : { _tag: "Miss", fingerprint, scope: options.scope }
                )
              )
            )
          )
        ),
      invalidate: (config) =>
        prepareKey(descriptor, config).pipe(
          Effect.flatMap(({ encoded, fingerprint }) =>
            schemaCache.remove(descriptor, encoded).pipe(
              Effect.tap(() => emitObservation({ _tag: "Invalidation", fingerprint, scope: options.scope }))
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
 * A fresh Layer starts empty, has no requirements, and performs no release action.
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
