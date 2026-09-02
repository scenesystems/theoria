/**
 * Optional cache events emitted by study-level integrations.
 *
 * @since 0.1.0
 */
import { Data, Effect, Schema } from "effect"

/**
 * Decodes a hit, miss, or invalidation with its fingerprint and integration-defined scope.
 * The schema does not validate that the fingerprint came from either public fingerprint API.
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
 * Cache outcome associated with an integration-defined scope and fingerprint.
 *
 * @since 0.1.0
 * @category models
 */
export type CacheObservabilityEvent = Schema.Schema.Type<typeof CacheObservabilityEventSchema>

const CacheObservabilityEvents = Data.taggedEnum<CacheObservabilityEvent>()

/**
 * Constructs an event for a value reused without computation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheHit = CacheObservabilityEvents.Hit

/**
 * Constructs an event for a value computed after lookup missed.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheMiss = CacheObservabilityEvents.Miss

/**
 * Constructs an event for an invalidation requested by an integration.
 *
 * @since 0.1.0
 * @category constructors
 */
export const CacheInvalidation = CacheObservabilityEvents.Invalidation

/**
 * Records cache events selected by study-level integrations.
 *
 * @remarks
 * `SchemaCache` does not require this service or emit events. The study objective-cache
 * adapter supplies its own scope and fingerprint when an observer is available. The
 * observer API has no typed failure channel but implementations may interrupt or defect.
 *
 * @since 0.1.0
 * @category services
 */
export class CacheObserver extends Effect.Tag("effect-search/CacheObserver")<
  CacheObserver,
  {
    /** Records one study-selected cache outcome after the associated operation. */
    readonly record: (event: CacheObservabilityEvent) => Effect.Effect<void>
  }
>() {}
