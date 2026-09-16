/**
 * Cache keys and the service contract for language-model call memoization.
 *
 * @since 0.1.0
 * @module
 */
import type * as PlatformError from "@effect/platform/Error"
import type * as FileSystem from "@effect/platform/FileSystem"
import type * as Path from "@effect/platform/Path"
import type * as SqlClient from "@effect/sql/SqlClient"
import {
  type CacheBackendError,
  CacheCorrupt,
  type CacheError,
  type CacheResolution,
  durableFingerprint,
  makeDescriptor,
  SchemaCache,
  SchemaCacheFileSystem,
  SchemaCacheMemory,
  SchemaCacheSql
} from "@scenesystems/effect-search/Cache"
import { Effect, FiberRef, Layer, Schema } from "effect"

import { RolloutRef } from "./internal/cache/rollout.js"

/**
 * Identifies one language-model call within a module, runtime, and rollout.
 *
 * @remarks
 * Input and parameter values are represented by durable fingerprints. A present
 * rollout index keeps concurrent candidate evaluations in separate partitions.
 *
 * @since 0.1.0
 * @category models
 */
export class Key extends Schema.Class<Key>("effect-dsp/Cache/Key")({
  /** Stable identity supplied by the calling module. */
  moduleFingerprint: Schema.String,
  /** Stable identity supplied by the language-model runtime. */
  runtimeFingerprint: Schema.String,
  /** Durable fingerprint of the module input. */
  inputHash: Schema.String,
  /** Durable fingerprint of the generation parameters. */
  paramsHash: Schema.String,
  /** Candidate partition inherited from {@link withRollout}, when present. */
  rolloutId: Schema.Option(Schema.Number)
}) {}

const DSP_CACHE_NAMESPACE = "effect-dsp/lm-cache"
const DSP_CACHE_VERSION = "v1"

/**
 * Memoizes decoded language-model results under content-derived keys.
 *
 * @remarks
 * A resolution reports `"hit"` when it reads a stored value and `"miss"` when
 * it runs and stores `compute`. Failures from `compute` retain their original
 * error type and are not stored. Key construction, backend access, and value
 * decoding fail with `CacheError`. Entry lifetime belongs to the configured
 * cache backend.
 *
 * @since 0.1.0
 * @category services
 */
export class Cache extends Effect.Tag("effect-dsp/Cache")<
  Cache,
  {
    /**
     * Reads a matching value or evaluates `compute` and stores its successful
     * result. Calls for the same key are serialized by the configured cache.
     */
    readonly resolve: <O, E, R>(request: {
      /** Stable identity of the module implementation and prompt contract. */
      readonly moduleFingerprint: string
      /** Stable identity of the language-model runtime configuration. */
      readonly runtimeFingerprint: string
      /** Value included in the cache key through durable fingerprinting. */
      readonly input: unknown
      /** Generation parameters included in the cache key through durable fingerprinting. */
      readonly params: unknown
      /** Codec used to persist and validate successful results. */
      readonly outputSchema: Schema.Schema<O>
      /** Operation evaluated only after a cache miss. */
      readonly compute: Effect.Effect<O, E, R>
    }) => Effect.Effect<
      readonly [O, CacheResolution],
      E | CacheError,
      R
    >
  }
>() {}

const fingerprintOrCorrupt = (
  value: unknown,
  label: string
): Effect.Effect<string, CacheCorrupt> =>
  durableFingerprint(value).pipe(
    Effect.mapError((cause) =>
      new CacheCorrupt({
        key: DSP_CACHE_NAMESPACE,
        reason: `${label} fingerprint: ${cause._tag}`
      })
    )
  )

/**
 * Computes a cache key from caller identities, request content, and the current
 * rollout partition.
 *
 * @remarks
 * Input and parameter fingerprints are computed concurrently. Unsupported,
 * cyclic, or noncanonical values fail with `CacheCorrupt`; the error reason
 * identifies which value could not be fingerprinted.
 *
 * @param request - Identities and request values that determine cache equality.
 * @returns A key containing both durable fingerprints and the current
 *   rollout partition set by {@link withRollout}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const key = (request: {
  readonly moduleFingerprint: string
  readonly runtimeFingerprint: string
  readonly input: unknown
  readonly params: unknown
}): Effect.Effect<Key, CacheCorrupt> =>
  Effect.all({
    inputHash: fingerprintOrCorrupt(request.input, "input"),
    paramsHash: fingerprintOrCorrupt(request.params, "params"),
    rolloutId: FiberRef.get(RolloutRef)
  }).pipe(
    Effect.map(({ inputHash, paramsHash, rolloutId }) =>
      new Key({
        moduleFingerprint: request.moduleFingerprint,
        runtimeFingerprint: request.runtimeFingerprint,
        inputHash,
        paramsHash,
        rolloutId
      })
    )
  )

/** Adapts the configured schema cache to language-model memoization.
 * @since 0.1.0
 * @category layers
 */
export const layer: Layer.Layer<Cache, never, SchemaCache> = Layer.effect(
  Cache,
  Effect.gen(function*() {
    const schemaCache = yield* SchemaCache
    return Cache.of({
      resolve: <O, E, R>(request: {
        readonly moduleFingerprint: string
        readonly runtimeFingerprint: string
        readonly input: unknown
        readonly params: unknown
        readonly outputSchema: Schema.Schema<O>
        readonly compute: Effect.Effect<O, E, R>
      }): Effect.Effect<readonly [O, CacheResolution], E | CacheError, R> =>
        key(request).pipe(
          Effect.flatMap((cacheKey) =>
            schemaCache.resolve({
              descriptor: makeDescriptor(
                DSP_CACHE_NAMESPACE,
                DSP_CACHE_VERSION,
                Key,
                request.outputSchema
              ),
              key: cacheKey,
              compute: request.compute
            })
          )
        )
    })
  })
)

/** In-memory cache layer.
 * @since 0.1.0
 * @category layers
 */
export const layerMemory: Layer.Layer<Cache> = Layer.provide(layer, SchemaCacheMemory)

/** Filesystem-backed cache layer.
 * @since 0.1.0
 * @category layers
 */
export const layerFileSystem = (
  directory: string
): Layer.Layer<Cache, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
  Layer.provide(layer, SchemaCacheFileSystem(directory))

/** SQL-backed cache layer.
 * @since 0.1.0
 * @category layers
 */
export const layerSql = (
  sqlClientLayer: Layer.Layer<SqlClient.SqlClient, CacheBackendError>
): Layer.Layer<Cache, CacheBackendError> => Layer.provide(layer, SchemaCacheSql(sqlClientLayer))

export { withRollout } from "./internal/cache/rollout.js"
