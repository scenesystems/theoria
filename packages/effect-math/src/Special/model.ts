/**
 * Publishes the Special-functions discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { SpecialDomainContract } from "./contract.js"
import type { SpecialDomain } from "./schema.js"

/**
 * Metadata identifying the Special API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const SpecialDomainModel: SpecialDomain = {
  domain: SpecialDomainContract,
  stability: "provisional"
}
