/**
 * Typed cache authority error taxonomy.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * A cache key or value could not be encoded, fingerprinted, or decoded.
 *
 * @remarks
 * `key` is the resolved persistence key when available; key-encoding and
 * fingerprint failures report the descriptor's `namespace:version:` prefix.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheCorrupt extends Schema.TaggedError<CacheCorrupt>()("effect-search/CacheCorrupt", {
  key: Schema.String,
  reason: Schema.String
}) {}

/**
 * Reports a rejected read, write, removal, or initialization request from the
 * configured key-value backend.
 *
 * @remarks
 * `operation` identifies the attempted backend step. `reason` may include a
 * platform or database diagnostic and is not redacted for untrusted output.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheBackendError extends Schema.TaggedError<CacheBackendError>()("effect-search/CacheBackendError", {
  operation: Schema.String,
  reason: Schema.String
}) {}

/**
 * Defines the cache boundary between malformed identity/content and rejected
 * persistence operations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CacheErrorSchema = Schema.Union(CacheCorrupt, CacheBackendError)

/**
 * Failure channel shared by `SchemaCache` operations: invalid encoded content
 * or fingerprints, or a rejected backing-store operation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CacheError = Schema.Schema.Type<typeof CacheErrorSchema>

/**
 * Indicates whether `SchemaCache.resolve` returned a stored value or computed one.
 *
 * @since 0.1.0
 * @category models
 */
export const CacheResolutionSchema = Schema.Literal("hit", "miss")

/**
 * Distinguishes a decoded stored value from one computed and persisted during
 * `SchemaCache.resolve`.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolution = Schema.Schema.Type<typeof CacheResolutionSchema>
