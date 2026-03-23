/**
 * DspCache layer constructors delegating to `effect-search/Cache` shared
 * authority backends.
 *
 * @since 0.0.0
 */
import type * as PlatformError from "@effect/platform/Error"
import type * as FileSystem from "@effect/platform/FileSystem"
import type * as Path from "@effect/platform/Path"
import { Effect, Layer, type Schema } from "effect"
import {
  type CacheBackendError,
  type CacheError,
  type CacheResolution,
  makeDescriptor,
  SchemaCache,
  SchemaCacheFileSystem,
  SchemaCacheMemory,
  SchemaCacheSqlite
} from "effect-search/Cache"

import { buildDspCacheKey, DspCache, DspCacheKey } from "./model.js"

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"
const DSP_CACHE_VERSION = "v1"

/**
 * Live implementation of {@link DspCache} backed by a {@link SchemaCache}
 * service from `effect-search/Cache`. Constructs a `CacheDescriptor`
 * per-resolve call using the caller's `outputSchema` as the value codec
 * and {@link DspCacheKey} as the key codec.
 *
 * @see {@link DspCacheMemory} — pre-wired in-memory layer for tests
 * @see {@link DspCacheFileSystem} — file-system persistence
 * @see {@link DspCacheSqlite} — SQLite persistence
 *
 * @since 0.0.0
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
 * In-memory {@link DspCache} — suitable for tests and short-lived
 * processes. No persistence between runs. Fully self-contained with
 * no platform requirements.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.0.0
 * @category layers
 */
export const DspCacheMemory: Layer.Layer<DspCache> = Layer.provide(
  DspCacheLive,
  SchemaCacheMemory
)

/**
 * File-system-backed {@link DspCache} — entries persist as files in the
 * given directory. Requires platform `FileSystem` and `Path` services
 * to be provided.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.0.0
 * @category layers
 */
export const DspCacheFileSystem = (
  directory: string
): Layer.Layer<DspCache, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Layer.provide(DspCacheLive, SchemaCacheFileSystem(directory))

/**
 * SQLite-backed {@link DspCache} — entries persist in a SQLite database
 * in the given directory. Uses `@effect/sql-sqlite-node` via the
 * shared `effect-search/Cache` authority.
 *
 * @see {@link DspCacheLive} — base layer for custom backend wiring
 *
 * @since 0.0.0
 * @category layers
 */
export const DspCacheSqlite = (directory: string): Layer.Layer<DspCache, CacheBackendError> =>
  Layer.provide(DspCacheLive, SchemaCacheSqlite(directory))
