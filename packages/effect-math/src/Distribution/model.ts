/**
 * Publishes the Distribution discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { DistributionDomainContract } from "./contract.js"
import type { DistributionDomain } from "./schema.js"

/**
 * Identifies distribution evaluation as a provisional API in domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
export const DistributionDomainModel: DistributionDomain = {
  domain: DistributionDomainContract,
  stability: "provisional"
}
