/**
 * Service provider interface (SPI) tag and layer for wiring a concrete Sampler implementation into the Effect runtime.
 *
 * @since 0.1.0
 */
import { Effect, Layer } from "effect"

import type { InvalidStudyConfig, SearchError } from "../Errors/index.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import type { SamplerCheckpoint } from "./kinds.js"
import type { Sampler } from "./model.js"
import type { SuggestContext } from "./SuggestContext.js"

/**
 * Service provider interface that bridges a {@link Sampler} implementation to
 * the runtime. Consumers depend on this tag rather than a concrete algorithm,
 * enabling sampler swaps (Random → TPE) without touching call-sites.
 *
 * @see {@link SamplerSpiLayer} constructs the layer from a concrete sampler
 * @see {@link Sampler} the algorithm contract this tag wraps
 * @since 0.1.0
 * @category services
 */
export class SamplerSpi extends Effect.Tag("effect-search/Sampler/Spi")<
  SamplerSpi,
  {
    readonly suggest: (
      space: SearchSpace.SearchSpace,
      context: SuggestContext
    ) => Effect.Effect<unknown, SearchError>
    readonly checkpoint: Effect.Effect<SamplerCheckpoint, SearchError>
    readonly restore: (
      checkpoint: SamplerCheckpoint
    ) => Effect.Effect<void, InvalidStudyConfig>
  }
>() {}

/**
 * Construct the {@link SamplerSpi} layer by delegating `suggest`, `checkpoint`,
 * and `restore` to a concrete {@link Sampler} implementation. Typically called
 * once during study setup to wire the chosen algorithm into the runtime.
 *
 * @see {@link SamplerSpi} the service this layer provides
 * @see {@link Sampler} the algorithm contract consumed here
 * @since 0.1.0
 * @category layers
 */
export const SamplerSpiLayer = (sampler: Sampler): Layer.Layer<SamplerSpi> =>
  Layer.succeed(SamplerSpi, {
    suggest: (space, context) => sampler.suggest(space, context),
    checkpoint: sampler.checkpoint,
    restore: sampler.restore
  })
