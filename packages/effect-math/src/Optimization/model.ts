/**
 * Defines the Optimization descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { OptimizationDomainContract } from "./contract.js"
import type { OptimizationDomain } from "./schema.js"

/**
 * Classifies the Optimization domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const OptimizationDomainModel: OptimizationDomain = {
  domain: OptimizationDomainContract,
  stability: "provisional"
}
