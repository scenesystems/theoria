/**
 * Optimization domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { OptimizationDomainContract } from "./contract.js"
import type { OptimizationDomain } from "./schema.js"

/**
 * Optimization domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const OptimizationDomainModel: OptimizationDomain = {
  domain: OptimizationDomainContract,
  stability: "provisional"
}
