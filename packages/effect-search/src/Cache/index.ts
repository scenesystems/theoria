/**
 * Schema-encoded caching under canonical fingerprints.
 *
 * @remarks
 * A descriptor partitions persisted entries and defines their codecs. `SchemaCache`
 * serializes every lookup, mutation, and resolution of the same persistence key within
 * one service instance while allowing different keys to progress independently. It
 * leaves computation failures in the caller's error channel without caching them and
 * immediately discards failed backing lookups so a following call can retry.
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
  SchemaCacheRequest,
  type SchemaCacheResult,
  SchemaCacheSql
} from "./schemaCache.js"
