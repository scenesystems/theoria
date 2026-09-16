/**
 * Scoped memoization of successful text measurements.
 *
 * @since 0.5.0
 * @module
 */
import { Cache, Context, Effect, Layer } from "effect"

import { fontKey, getOrEvict, MeasurementKey } from "./internal/cache.js"
import * as TextMeasurer from "./TextMeasurer.js"

/**
 * The measurement capability with successful advances shared across readers.
 * Its service uses the canonical `TextMeasurer` contract.
 *
 * @since 0.5.0
 * @category services
 */
export class MeasurementCache extends Context.Tag("effect-text/MeasurementCache")<
  MeasurementCache,
  Context.Tag.Service<typeof TextMeasurer.TextMeasurer>
>() {}

/**
 * Provides a 1,024-entry cache with a 24-hour lifetime per successful entry.
 * Failed measurements are evicted. Closing the scope interrupts pending work;
 * interrupting one reader only stops that reader. Font availability changes
 * require a fresh owning layer, not a parallel mutable cache generation.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer = Layer.scoped(
  MeasurementCache,
  Effect.gen(function*() {
    const measurer = yield* TextMeasurer.TextMeasurer
    const owner = yield* Effect.scope
    const cache = yield* Cache.make({
      capacity: 1024,
      timeToLive: "24 hours",
      lookup: (key: MeasurementKey) => measurer.measure(key.font, key.text)
    })
    return MeasurementCache.of({
      measure: (font, text) => getOrEvict(cache, owner, new MeasurementKey({ font: fontKey(font), text }))
    })
  })
)
