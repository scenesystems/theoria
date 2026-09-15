/**
 * Defines the Calculus descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { Schema } from "effect"

import { CalculusDomainContract } from "./contract.js"
import { CalculusDomainSchema } from "./schema.js"

/**
 * Classifies the Calculus domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const CalculusDomainModel = Schema.decodeSync(CalculusDomainSchema)({
  domain: CalculusDomainContract,
  stability: "provisional"
})
