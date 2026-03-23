import { Effect } from "effect"

import { ProbabilityDomainModel } from "./model.js"

/**
 * Probability operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadProbabilityDomain = Effect.succeed(ProbabilityDomainModel)
