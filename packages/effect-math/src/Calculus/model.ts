/**
 * Defines the Calculus descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { CalculusDomainContract } from "./contract.js"
import type { CalculusDomain } from "./schema.js"

/**
 * Classifies the Calculus domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const CalculusDomainModel: CalculusDomain = {
  domain: CalculusDomainContract,
  stability: "provisional"
}
