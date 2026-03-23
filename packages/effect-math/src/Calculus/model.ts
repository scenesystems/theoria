import { CalculusDomainContract } from "./contract.js"
import type { CalculusDomain } from "./schema.js"

/**
 * Calculus domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const CalculusDomainModel: CalculusDomain = {
  domain: CalculusDomainContract,
  stability: "provisional"
}
