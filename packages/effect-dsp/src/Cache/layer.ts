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
  type BackendError,
  Cache,
  type Error as CacheError,
  KeySpace,
  layerFileSystem,
  layerMemory,
  layerSql,
  Request,
  type Result as CacheResult
} from "@scenesystems/effect-search/Cache"
import { Effect, Layer } from "effect"

import { buildDspCacheKey, DspCache, DspCacheKey, type DspCacheRequest } from "./model.js"

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"

/**
 * Adapts the configured {@link Cache} to language-model call memoization.
 *
 * @remarks
 * Entries use namespace `effect-dsp/lm-cache` and {@link DspCacheKey} as the
 * key codec. Each request supplies its value codec.
 * The layer performs no additional acquisition or release; storage lifetime and
 * operation failures come from the supplied cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheLive: Layer.Layer<DspCache, never, Cache> = Layer.effect(
  DspCache,
  Effect.gen(function*() {
    const cache = yield* Cache

    return DspCache.of({
      resolve: <Input, Params, Output, Failure, Requirement, EncodedOutput = Output>(
        request: DspCacheRequest<Input, Params, Output, Failure, Requirement, EncodedOutput>
      ): Effect.Effect<CacheResult<Output>, Failure | CacheError, Requirement> =>
        buildDspCacheKey(request).pipe(
          Effect.flatMap((key) => {
            const keySpace = new KeySpace({
              namespace: DSP_CACHE_NAMESPACE,
              keySchema: DspCacheKey,
              valueSchema: request.outputSchema
            })

            return cache.resolve(
              new Request({
                keySpace,
                key,
                compute: request.compute
              })
            )
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
  layerMemory
)

/**
 * Persists memoized values beneath a filesystem directory.
 *
 * @remarks
 * Entries remain available to later processes that use the same directory and
 * namespace. Layer acquisition requires platform filesystem and path
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
  Layer.provide(DspCacheLive, layerFileSystem(directory))

/**
 * Persists memoized values through a SQLite-compatible SQL client.
 *
 * @remarks
 * The supplied client layer determines connection acquisition, release, and
 * persistence lifetime. Backend setup failures remain `BackendError`.
 *
 * @param sqlClientLayer - Layer that acquires the database client used by the cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, BackendError>
): Layer.Layer<DspCache, BackendError> => Layer.provide(DspCacheLive, layerSql(sqlClientLayer))
