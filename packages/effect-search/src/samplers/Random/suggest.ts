import { Effect } from "effect"

import type { SearchError } from "../../Errors/index.js"
import type { SuggestContext } from "../../Sampler/index.js"
import { rngByTrial } from "../../Sampler/shared/rngByTrial.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { configObject } from "./config.js"
import { sampleParameters } from "./parameters.js"

export const suggest = (
  seed: number,
  space: SearchSpace.SearchSpace,
  context: SuggestContext
): Effect.Effect<unknown, SearchError> => {
  const rng = rngByTrial("random", seed, context.nextTrialNumber)

  return sampleParameters(rng, space.params).pipe(Effect.map(configObject))
}
