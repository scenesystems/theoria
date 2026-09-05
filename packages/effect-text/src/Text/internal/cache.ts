/**
 * Cache reads that keep only successes.
 *
 * @since 0.2.0
 */
import type { Cache } from "effect"
import { Effect } from "effect"

/**
 * Reads `key`, evicting it when the lookup failed. `Cache` stores the lookup's
 * exit whatever it is, so a measurement that failed once (a font that was not
 * yet ready, a context that threw) would otherwise be that failure for the
 * whole time to live; after this read the next request measures again.
 *
 * @since 0.2.0
 * @category internals
 */
export const getOrEvict = <Key, Value, Failure>(
  cache: Cache.Cache<Key, Value, Failure>,
  key: Key
): Effect.Effect<Value, Failure> => cache.get(key).pipe(Effect.tapErrorCause(() => cache.invalidate(key)))
