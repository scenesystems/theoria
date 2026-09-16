/**
 * Defines the Optimization descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { Schema } from "effect"

import { OptimizationDomainContract } from "./contract.js"
import { OptimizationDomainSchema } from "./schema.js"

/**
 * Classifies the Optimization domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const OptimizationDomainModel = Schema.decodeSync(OptimizationDomainSchema)({
  domain: OptimizationDomainContract,
  stability: "provisional"
})
