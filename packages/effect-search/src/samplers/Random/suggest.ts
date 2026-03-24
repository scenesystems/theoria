/**
 * Random sampler suggestion — produces a full configuration from per-trial RNG.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { SearchError } from "../../Errors/index.js"
import type { SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { configObject } from "./config.js"
import { sampleParameters } from "./parameters.js"

/**
 * Produces a complete configuration by seeding a per-trial RNG and sampling
 * all active parameters, returning a plain config record.
 *
 * Each trial gets a deterministic RNG derived from the base seed and trial
 * number, ensuring reproducibility across runs.
 *
 * @see {@link sampleParameters} for the parameter iteration logic
 * @see {@link rngByTrial} for per-trial seed derivation
 * @since 0.1.0
 * @category sampling
 */
export const suggest = (
  seed: number,
  space: SearchSpace.SearchSpace,
  context: SuggestContext
): Effect.Effect<unknown, SearchError> => {
  const rng = rngByTrial("random", seed, context.nextTrialNumber)

  return sampleParameters(rng, space.params).pipe(Effect.map(configObject))
}
