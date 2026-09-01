/**
 * Publishes the Statistics discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { StatisticsDomainContract } from "./contract.js"
import type { StatisticsDomain } from "./schema.js"

/**
 * Metadata identifying the Statistics API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const StatisticsDomainModel: StatisticsDomain = {
  domain: StatisticsDomainContract,
  stability: "provisional"
}
