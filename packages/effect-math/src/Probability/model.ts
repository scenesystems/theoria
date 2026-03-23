import { ProbabilityDomainContract } from "./contract.js"
import type { ProbabilityDomain } from "./schema.js"

/**
 * Probability domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const ProbabilityDomainModel: ProbabilityDomain = {
  domain: ProbabilityDomainContract,
  stability: "provisional"
}
