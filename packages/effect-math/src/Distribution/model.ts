/**
 * Defines the Distribution descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { DistributionDomainContract } from "./contract.js"
import type { DistributionDomain } from "./schema.js"

/**
 * Classifies the Distribution domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const DistributionDomainModel: DistributionDomain = {
  domain: DistributionDomainContract,
  stability: "provisional"
}
