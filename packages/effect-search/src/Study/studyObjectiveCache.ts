/**
 * Study-specific objective cache adapter over shared cache authority.
 *
 * @since 0.1.0
 */
import { Data, Effect, Layer, Option, Schema } from "effect"
import type * as Context from "effect/Context"

import * as Cache from "../Cache/index.js"
import type { CacheObservabilityEvent } from "../Cache/observer.js"
import { CacheObserver } from "../Cache/observer.js"
import { type ObjectiveValue, ObjectiveValueSchema } from "../contracts/ObjectiveValue.js"

const DEFAULT_SCOPE = "study"

/**
 * @since 0.1.0
 * @category models
 */
export class StudyObjectiveCacheOptions extends Data.Class<{
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
 * @since 0.1.0
 * @category constructors
 */
export const studyObjectiveCacheOptions = (scope: string): StudyObjectiveCacheOptions =>
  new StudyObjectiveCacheOptions({ scope })

const descriptorFor = (options: StudyObjectiveCacheOptions) =>
  Cache.makeDescriptor(`${options.scope}/objective`, "v1", StudyObjectiveCacheKeySchema, ObjectiveValueSchema)

/**
 * @since 0.1.0
 * @category services
 */
export class StudyObjectiveCache extends Effect.Tag("effect-search/Study/StudyObjectiveCache")<
  StudyObjectiveCache,
  {
    readonly resolve: <E, Requirement>(args: {
      readonly config: StudyObjectiveCacheKey
      readonly compute: Effect.Effect<ObjectiveValue, E, Requirement>
    }) => Effect.Effect<readonly [ObjectiveValue, Cache.CacheResolution], Cache.CacheError | E, Requirement>
    readonly invalidate: (config: StudyObjectiveCacheKey) => Effect.Effect<void, Cache.CacheError>
  }
>() {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyObjectiveCacheError = Cache.CacheError

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyObjectiveCacheApi = Context.Tag.Service<typeof StudyObjectiveCache>

/**
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
        Cache.durableFingerprint(config).pipe(
          Effect.catchAll(() => Effect.succeed("unknown")),
          Effect.flatMap((fingerprint) =>
            schemaCache.resolve({
              descriptor,
              key: config,
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
        Cache.durableFingerprint(config).pipe(
          Effect.catchAll(() => Effect.succeed("unknown")),
          Effect.flatMap((fingerprint) =>
            schemaCache.remove(descriptor, config).pipe(
              Effect.tap(() => emitObservation({ _tag: "Invalidation", fingerprint, scope: options.scope }))
            )
          )
        )
    }
  })

/**
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheLive = (options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS) =>
  Layer.effect(StudyObjectiveCache, makeStudyObjectiveCache(options))

/**
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheMemory = (options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS) =>
  StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheMemory))

/**
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheFileSystem = (
  directory: string,
  options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS
) => StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheFileSystem(directory)))

/**
 * @since 0.1.0
 * @category layers
 */
export const StudyObjectiveCacheSqlite = (
  directory: string,
  options: StudyObjectiveCacheOptions = DEFAULT_OPTIONS
) => StudyObjectiveCacheLive(options).pipe(Layer.provide(Cache.SchemaCacheSqlite(directory)))
