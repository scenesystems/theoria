/**
 * Typed cache authority error taxonomy.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Persisted bytes exist but cannot be decoded by the descriptor schema.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheCorrupt extends Schema.TaggedError<CacheCorrupt>()("effect-search/CacheCorrupt", {
  key: Schema.String,
  reason: Schema.String
}) {}

/**
 * Backing persistence operation failed.
 *
 * @since 0.1.0
 * @category errors
 */
export class CacheBackendError extends Schema.TaggedError<CacheBackendError>()("effect-search/CacheBackendError", {
  operation: Schema.String,
  reason: Schema.String
}) {}

/**
 * Discriminated union of all recoverable cache failures. Consumers can
 * pattern-match on `_tag` to distinguish corruption from backend errors.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CacheErrorSchema = Schema.Union(CacheCorrupt, CacheBackendError)

/**
 * Type-level extraction of {@link CacheErrorSchema} for use in Effect
 * error channels.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CacheError = Schema.Schema.Type<typeof CacheErrorSchema>

/**
 * Cache hit/miss resolution marker returned by resolve semantics.
 *
 * @since 0.1.0
 * @category models
 */
export const CacheResolutionSchema = Schema.Literal("hit", "miss")

/**
 * @since 0.1.0
 * @category type-level
 */
export type CacheResolution = Schema.Schema.Type<typeof CacheResolutionSchema>
