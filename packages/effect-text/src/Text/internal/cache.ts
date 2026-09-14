/**
 * Cache reads that keep only successes.
 *
 * @since 0.2.0
 */
import type { Cache, Scope } from "effect"
import { Data, Effect, Fiber, Option } from "effect"

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
 * A lookup is `owner`'s work, not the reader's. `Cache` runs a lookup in the
 * fiber that misses and interrupts the pending entry when that fiber is
 * interrupted, so every other fiber awaiting the key would fail with an
 * interrupt that is not its own. Here a miss forks the lookup into `owner`
 * and waits on it: a reader interrupted while waiting stops waiting and
 * nothing else — the lookup finishes and is the cache's for every other
 * reader — and closing `owner` stops every lookup still pending. A hit is
 * answered without a fork.
 *
 * @since 0.2.0
 * @category internals
 */
export const getOrEvict = <Key, Value, Failure>(
  cache: Cache.Cache<Key, Value, Failure>,
  owner: Scope.Scope,
  key: Key
): Effect.Effect<Value, Failure> => {
  const evicting = <A>(read: Effect.Effect<A, Failure>) => Effect.tapErrorCause(read, () => cache.invalidate(key))
  return Effect.flatMap(
    evicting(cache.getOption(key)),
    Option.match({
      onNone: () => Effect.flatMap(Effect.forkIn(evicting(cache.get(key)), owner), Fiber.join),
      onSome: Effect.succeed
    })
  )
}
