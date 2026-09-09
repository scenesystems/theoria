/**
 * Cache reads that keep only successes.
 *
 * @since 0.2.0
 */
import type { Cache } from "effect"
import { Data, Effect } from "effect"

import type { FontDescriptorType } from "../schema.js"

/**
 * Font as the measurement caches see it: an omitted weight is the normal
 * weight, so descriptors that measure identically share one entry. Equality and
 * hash are structural, so the key needs no serialization.
 *
 * @since 0.4.0
 * @category internals
 */
export class FontKey extends Data.Class<{
  readonly family: string
  readonly size: number
  readonly weight: number
}> {}

/**
 * Normalizes a font descriptor into its cache key.
 *
 * @since 0.4.0
 * @category internals
 */
export const fontKey = (font: FontDescriptorType): FontKey =>
  new FontKey({ family: font.family, size: font.size, weight: font.weight ?? 400 })

/**
 * The descriptor a cache lookup measures with; the weight is always explicit.
 *
 * @since 0.4.0
 * @category internals
 */
export const fontDescriptor = (key: FontKey): FontDescriptorType => ({
  family: key.family,
  size: key.size,
  weight: key.weight
})

/**
 * One measured string in one font.
 *
 * @since 0.4.0
 * @category internals
 */
export class MeasurementKey extends Data.Class<{
  readonly font: FontKey
  readonly text: string
}> {}

/**
 * Reads `key`, evicting it when the lookup failed. `Cache` stores the lookup's
 * exit whatever it is, so a measurement that failed once (a font that was not
 * yet ready, a context that threw) would otherwise be that failure for the
 * whole time to live; after this read the next request measures again.
 *
 * The read is uninterruptible. A lookup, once begun, is finished and shared:
 * `Cache` otherwise interrupts the pending entry's `Deferred` when the fiber
 * that began the lookup is interrupted, and every other fiber awaiting that
 * key then fails with an interrupt that is not its own. Measurements are
 * bounded — a canvas or an estimate — so a fiber interrupted mid-read waits at
 * most one measurement before the interrupt takes effect.
 *
 * @since 0.2.0
 * @category internals
 */
export const getOrEvict = <Key, Value, Failure>(
  cache: Cache.Cache<Key, Value, Failure>,
  key: Key
): Effect.Effect<Value, Failure> =>
  cache.get(key).pipe(
    Effect.tapErrorCause(() => cache.invalidate(key)),
    Effect.uninterruptible
  )
