/**
 * Stores schema-encoded values under durable fingerprints and exposes
 * memory, file-system, and SQLite Layers for the cache service.
 *
 * @remarks
 * Define key and value codecs with `CacheDescriptor`, then resolve entries
 * through `SchemaCache`. Concurrent resolutions for the same key share a
 * per-service critical section; compute failures remain uncached in their
 * original Effect error channel.
 *
 * @since 0.1.0
 */

export {
  /** @since 0.1.0 */
  CacheDescriptor,
  /** @since 0.1.0 */
  makeDescriptor
} from "./descriptor.js"

export {
  /** @since 0.1.0 */
  CacheBackendError,
  /** @since 0.1.0 */
  CacheCorrupt,
  /** @since 0.1.0 */
  CacheErrorSchema,
  /** @since 0.1.0 */
  CacheResolutionSchema
} from "./errors.js"

export type {
  /** @since 0.1.0 */
  CacheError,
  /** @since 0.1.0 */
  CacheResolution
} from "./errors.js"

export {
  /** @since 0.1.0 */
  durableFingerprint,
  /** @since 0.1.0 */
  runtimeFingerprint,
  /** @since 0.3.0 */
  RuntimeFingerprintError
} from "./fingerprint.js"

export {
  /** @since 0.1.0 */
  CacheHit,
  /** @since 0.1.0 */
  CacheInvalidation,
  /** @since 0.1.0 */
  CacheMiss,
  /** @since 0.1.0 */
  CacheObservabilityEventSchema,
  /** @since 0.1.0 */
  CacheObserver
} from "./observer.js"

export type {
  /** @since 0.1.0 */
  CacheObservabilityEvent
} from "./observer.js"

export {
  /** @since 0.1.0 */
  makeSchemaCache,
  /** @since 0.1.0 */
  SchemaCache,
  /** @since 0.1.0 */
  type SchemaCacheApi,
  /** @since 0.1.0 */
  SchemaCacheFileSystem,
  /** @since 0.1.0 */
  SchemaCacheLive,
  /** @since 0.1.0 */
  SchemaCacheMemory,
  /** @since 0.1.0 */
  SchemaCacheSql
} from "./schemaCache.js"
