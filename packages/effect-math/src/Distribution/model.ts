/**
 * Distribution domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { DistributionDomainContract } from "./contract.js"
import type { DistributionDomain } from "./schema.js"

/**
 * Static domain descriptor for the Distribution domain. Carries the
 * canonical domain discriminator and current stability tier.
 *
 * @since 0.1.0
 * @category models
 */
export const DistributionDomainModel: DistributionDomain = {
  domain: DistributionDomainContract,
  stability: "provisional"
}
