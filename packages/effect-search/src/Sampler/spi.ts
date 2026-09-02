/**
 * Effect service for sampler suggestion and checkpoint operations.
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
 * Exposes suggestion, checkpoint, and restore operations through the Effect
 * environment. The service excludes the sampler's lifecycle and pending-trial
 * policy; callers that own those concerns need the original {@link Sampler}.
 * @since 0.1.0
 * @category services
 */
export class SamplerSpi extends Effect.Tag("effect-search/Sampler/Spi")<
  SamplerSpi,
  {
    /** Requests one encoded candidate using the retained sampler instance. */
    readonly suggest: (
      space: SearchSpace.SearchSpace,
      context: SuggestContext
    ) => Effect.Effect<unknown, SearchError>
    /** Captures resumable state from the retained sampler. */
    readonly checkpoint: Effect.Effect<SamplerCheckpoint, SearchError>
    /** Replaces retained sampler state from a compatible checkpoint. */
    readonly restore: (
      checkpoint: SamplerCheckpoint
    ) => Effect.Effect<void, InvalidStudyConfig>
  }
>() {}

/**
 * Supplies {@link SamplerSpi} by delegating to one existing sampler instance.
 *
 * @remarks
 * The Layer acquires no resources and does not run the sampler's optional
 * lifecycle effects.
 *
 * @param sampler - Instance retained by the service for every operation.
 * @since 0.1.0
 * @category layers
 */
export const SamplerSpiLayer = (sampler: Sampler): Layer.Layer<SamplerSpi> =>
  Layer.succeed(SamplerSpi, {
    suggest: (space, context) => sampler.suggest(space, context),
    checkpoint: sampler.checkpoint,
    restore: sampler.restore
  })
