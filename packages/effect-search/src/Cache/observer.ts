/**
 * Cache observability — optional event recording for cache operations.
 *
 * @since 0.1.0
 */
import { Data, Effect, Schema } from "effect"

/**
 * Runtime schema for decoding and validating cache observability event.
 *
 * @since 0.1.0
 * @category schemas
 */
export const CacheObservabilityEventSchema = Schema.Union(
  Schema.TaggedStruct("Hit", {
    fingerprint: Schema.String,
    scope: Schema.String
  }),
  Schema.TaggedStruct("Miss", {
    fingerprint: Schema.String,
    scope: Schema.String
  }),
  Schema.TaggedStruct("Invalidation", {
    fingerprint: Schema.String,
    scope: Schema.String
  })
)

/**
 * An observability event emitted for a cache hit, miss, or invalidation.
 *
 * @since 0.1.0
 * @category models
 */
export type CacheObservabilityEvent = Schema.Schema.Type<typeof CacheObservabilityEventSchema>

const CacheObservabilityEvents = Data.taggedEnum<CacheObservabilityEvent>()

/**
 * Constructs an observability event for a cache hit.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheHit = CacheObservabilityEvents.Hit

/**
 * Constructs an observability event for a cache miss.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheMiss = CacheObservabilityEvents.Miss

/**
 * Constructs an observability event for a cache invalidation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheInvalidation = CacheObservabilityEvents.Invalidation

/**
 * Optional observer service for cache operations.
 *
 * When provided, the study objective cache emits hit/miss/invalidation events.
 * When absent, `Effect.serviceOption` returns `Option.none()` and no overhead
 * is incurred.
 *
 * @since 0.1.0
 * @category services
 */
export class CacheObserver extends Effect.Tag("effect-search/CacheObserver")<
  CacheObserver,
  {
    readonly record: (event: CacheObservabilityEvent) => Effect.Effect<void>
  }
>() {}
