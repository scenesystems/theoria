/**
 * Publishes the Probability discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { ProbabilityDomainContract } from "./contract.js"
import type { ProbabilityDomain } from "./schema.js"

/**
 * Metadata identifying the Probability API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const ProbabilityDomainModel: ProbabilityDomain = {
  domain: ProbabilityDomainContract,
  stability: "provisional"
}
