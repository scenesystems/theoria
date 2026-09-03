/**
 * Layers that bind language-model memoization to a cache backend.
 *
 * @since 0.1.0
 */
import type * as PlatformError from "@effect/platform/Error"
import type * as FileSystem from "@effect/platform/FileSystem"
import type * as Path from "@effect/platform/Path"
import type * as SqlClient from "@effect/sql/SqlClient"
import {
  type CacheBackendError,
  type CacheError,
  type CacheResolution,
  makeDescriptor,
  SchemaCache,
  SchemaCacheFileSystem,
  SchemaCacheMemory,
  SchemaCacheSql
} from "@scenesystems/effect-search/Cache"
import { Effect, Layer, type Schema } from "effect"

import { buildDspCacheKey, DspCache, DspCacheKey } from "./model.js"

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"
const DSP_CACHE_VERSION = "v1"

/**
 * Adapts the configured {@link SchemaCache} to language-model call memoization.
 *
 * @remarks
 * Entries use namespace `effect-dsp/lm-cache`, descriptor version `v1`, and
 * {@link DspCacheKey} as the key codec. Each request supplies its value codec.
 * The layer performs no additional acquisition or release; storage lifetime and
 * operation failures come from the supplied cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheLive: Layer.Layer<DspCache, never, SchemaCache> = Layer.effect(
  DspCache,
  Effect.gen(function*() {
    const schemaCache = yield* SchemaCache

    return DspCache.of({
      resolve: <O, E, R>(request: {
        readonly moduleFingerprint: string
        readonly runtimeFingerprint: string
        readonly input: unknown
        readonly params: unknown
        readonly outputSchema: Schema.Schema<O>
        readonly compute: Effect.Effect<O, E, R>
      }): Effect.Effect<
        readonly [O, CacheResolution],
        E | CacheError,
        R
      > =>
        buildDspCacheKey(request).pipe(
          Effect.flatMap((key) => {
            const descriptor = makeDescriptor(
              DSP_CACHE_NAMESPACE,
              DSP_CACHE_VERSION,
              DspCacheKey,
              request.outputSchema
            )

            return schemaCache.resolve({
              descriptor,
              key,
              compute: request.compute
            })
          })
        )
    })
  })
)

/**
 * Keeps memoized values in the service instance created by this layer.
 *
 * @remarks
 * Separate layer instances do not share entries, and process termination removes
 * all entries. The layer has no service requirements or acquisition failures.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheMemory: Layer.Layer<DspCache> = Layer.provide(
  DspCacheLive,
  SchemaCacheMemory
)

/**
 * Persists memoized values beneath a filesystem directory.
 *
 * @remarks
 * Entries remain available to later processes that use the same directory and
 * descriptor version. Layer acquisition requires platform filesystem and path
 * services and may fail with `PlatformError`.
 *
 * @param directory - Root directory owned by the cache backend.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheFileSystem = (
  directory: string
): Layer.Layer<DspCache, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Layer.provide(DspCacheLive, SchemaCacheFileSystem(directory))

/**
 * Persists memoized values through a SQLite-compatible SQL client.
 *
 * @remarks
 * The supplied client layer determines connection acquisition, release, and
 * persistence lifetime. Backend setup failures remain `CacheBackendError`.
 *
 * @param sqlClientLayer - Layer that acquires the database client used by the cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
): Layer.Layer<DspCache, CacheBackendError> => Layer.provide(DspCacheLive, SchemaCacheSql(sqlClientLayer))
