/**
 * Publishes the Optimization discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { OptimizationDomainContract } from "./contract.js"
import type { OptimizationDomain } from "./schema.js"

/**
 * Identifies iterative root-finding and one-dimensional minimization as a
 * provisional API in domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
export const OptimizationDomainModel: OptimizationDomain = {
  domain: OptimizationDomainContract,
  stability: "provisional"
}
