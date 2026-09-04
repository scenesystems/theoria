/**
 * Schema-encoded caching under canonical fingerprints.
 *
 * @remarks
 * A descriptor partitions persisted entries and defines their codecs. `SchemaCache`
 * serializes concurrent resolution of the same key within one service instance and
 * leaves computation failures in the caller's error channel without caching them.
 *
 * @since 0.1.0
 * @module
 */

export { CacheDescriptor, makeDescriptor } from "./descriptor.js"

export { CacheBackendError, CacheCorrupt, CacheErrorSchema, CacheResolutionSchema } from "./errors.js"

export type { CacheError, CacheResolution } from "./errors.js"

export { durableFingerprint, runtimeFingerprint, RuntimeFingerprintError } from "./fingerprint.js"

export { CacheHit, CacheInvalidation, CacheMiss, CacheObservabilityEventSchema, CacheObserver } from "./observer.js"

export type { CacheObservabilityEvent } from "./observer.js"

export {
  makeSchemaCache,
  SchemaCache,
  type SchemaCacheApi,
  SchemaCacheFileSystem,
  SchemaCacheLive,
  SchemaCacheMemory,
  SchemaCacheSql
} from "./schemaCache.js"
