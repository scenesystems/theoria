/**
 * DspCache layer constructors delegating to `@scenesystems/effect-search/Cache` shared
 * authority backends.
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
 * Adapter from a provided {@link SchemaCache} to {@link DspCache}. Every
 * resolution uses namespace `effect-dsp/lm-cache`, descriptor version `v1`,
 * {@link DspCacheKey} as the key codec, and the request's output schema as
 * the value codec. Storage lifetime follows the supplied `SchemaCache`.
 *
 * @see {@link DspCacheMemory} — pre-wired in-memory layer for tests
 * @see {@link DspCacheFileSystem} — file-system persistence
 * @see {@link DspCacheSql} — SQL persistence
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
 * In-memory {@link DspCache}. Entries live only as long as the layer's
 * in-memory service instance and require no platform services.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheMemory: Layer.Layer<DspCache> = Layer.provide(
  DspCacheLive,
  SchemaCacheMemory
)

/**
 * File-system-backed {@link DspCache} rooted at `directory`. Entries can
 * outlive the process; the layer requires `FileSystem` and `Path`, and its
 * construction may fail with `PlatformError`.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheFileSystem = (
  directory: string
): Layer.Layer<DspCache, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Layer.provide(DspCacheLive, SchemaCacheFileSystem(directory))

/**
 * SQL-backed {@link DspCache} using the supplied `SqlClient` layer and the
 * SQLite-compatible statements expected by `SchemaCacheSql`. Backend setup
 * failures remain `CacheBackendError`; persistence lifetime belongs to the
 * supplied database.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.1.0
 * @category layers
 */
export const DspCacheSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
): Layer.Layer<DspCache, CacheBackendError> => Layer.provide(DspCacheLive, SchemaCacheSql(sqlClientLayer))
