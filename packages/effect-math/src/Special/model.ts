/**
 * Special-functions domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { SpecialDomainContract } from "./contract.js"
import type { SpecialDomain } from "./schema.js"

/**
 * Special domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const SpecialDomainModel: SpecialDomain = {
  domain: SpecialDomainContract,
  stability: "provisional"
}
