/**
 * Shared cache authority surface.
 *
 * @since 0.1.0
 */

export {
  /** @since 0.1.0 */
  CacheDescriptor
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
  FingerprintUnsupportedValue,
  /** @since 0.1.0 */
  runtimeFingerprint
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
