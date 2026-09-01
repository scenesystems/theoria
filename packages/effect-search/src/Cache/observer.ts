/**
 * Cache observability — optional event recording for cache operations.
 *
 * @since 0.1.0
 */
import { Data, Effect, Schema } from "effect"

/**
 * Event vocabulary integrations may publish without making observation a
 * requirement of the underlying cache service.
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
 * Records that an integration reused a value without recomputing it.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheHit = CacheObservabilityEvents.Hit

/**
 * Records that an integration had to compute a value.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheMiss = CacheObservabilityEvents.Miss

/**
 * Records that an integration discarded the entry identified by the fingerprint.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheInvalidation = CacheObservabilityEvents.Invalidation

/**
 * Observer service consumed by study objective-cache integrations.
 *
 * @remarks
 * `SchemaCache` itself does not emit these events. Integrations record them
 * with the descriptor scope and the fingerprint used for that integration.
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
