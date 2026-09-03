/**
 * Publishes the Numeric discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { NumericDomainContract } from "./contract.js"
import type { NumericDomain } from "./schema.js"

/**
 * Metadata identifying the Numeric API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const NumericDomainModel: NumericDomain = {
  domain: NumericDomainContract,
  stability: "provisional"
}
