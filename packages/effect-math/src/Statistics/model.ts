import { StatisticsDomainContract } from "./contract.js"
import type { StatisticsDomain } from "./schema.js"

/**
 * Statistics domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const StatisticsDomainModel: StatisticsDomain = {
  domain: StatisticsDomainContract,
  stability: "provisional"
}
