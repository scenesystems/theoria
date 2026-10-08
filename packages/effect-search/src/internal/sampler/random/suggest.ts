/**
 * Random sampler suggestion — produces a full configuration from its persistent stream.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { SearchError } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type * as Rng from "../../rng.js"
import { configObject } from "./config.js"
import { sampleParameters } from "./parameters.js"

/**
 * Samples all active parameters in search-space order from the supplied stream.
 * Reproduction starts from the same seed or a saved sampler checkpoint.
 *
 * @see {@link sampleParameters} for the parameter iteration logic
 * @since 0.1.0
 * @category sampling
 */
export const suggest = (
  rng: Rng.Rng,
  space: SearchSpace.SearchSpace
): Effect.Effect<unknown, SearchError> => sampleParameters(rng, space.params).pipe(Effect.map(configObject))
