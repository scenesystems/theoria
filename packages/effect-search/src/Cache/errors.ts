/**
 * Expected codec, fingerprint, and backing-store failures from schema caches.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Reports a key-encoding, fingerprinting, value-encoding, or value-decoding failure.
 *
 * @remarks
 * `key` contains the full persistence key when fingerprinting succeeded. Earlier
 * key failures report only the descriptor's `namespace:version:` prefix. `reason`
 * contains the schema formatter or canonicalization tag and is not redacted.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheCorrupt extends Schema.TaggedError<CacheCorrupt>()("effect-search/CacheCorrupt", {
  /** Persistence key, or its namespace and version prefix when key construction failed. */
  key: Schema.String,
  /** Unredacted schema or canonicalization diagnostic. */
  reason: Schema.String
}) {}

/**
 * Reports a rejected operation from the configured key-value or SQL backend.
 *
 * @remarks
 * `operation` identifies the cache step. `reason` is formed from the underlying cause,
 * may expose platform or database diagnostics, and is not safe for untrusted output.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheBackendError extends Schema.TaggedError<CacheBackendError>()("effect-search/CacheBackendError", {
  /** Cache or storage step rejected by the backend. */
  operation: Schema.String,
  /** Unredacted diagnostic derived from the backend cause. */
  reason: Schema.String
}) {}

/**
 * Decodes either malformed cache content or a rejected backing-store operation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CacheErrorSchema = Schema.Union(CacheCorrupt, CacheBackendError)

/**
 * Expected failure from schema conversion, canonical key identity, or persistence.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CacheError = Schema.Schema.Type<typeof CacheErrorSchema>

/**
 * Decodes `"hit"` for a stored value and `"miss"` for a value computed and stored.
 *
 * @since 0.1.0
 * @category models
 */
export const CacheResolutionSchema = Schema.Literal("hit", "miss")

/**
 * Origin of the value returned by `SchemaCache.resolve`.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolution = Schema.Schema.Type<typeof CacheResolutionSchema>
