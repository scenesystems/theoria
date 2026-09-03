/**
 * Defines the canonical Statistics discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
import { StatisticsDomainContract } from "./contract.js"
import type { StatisticsDomain } from "./schema.js"

/**
 * Identifies the Statistics domain as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const StatisticsDomainModel: StatisticsDomain = {
  domain: StatisticsDomainContract,
  stability: "provisional"
}
