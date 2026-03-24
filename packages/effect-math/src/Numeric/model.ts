/**
 * Numeric domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { NumericDomainContract } from "./contract.js"
import type { NumericDomain } from "./schema.js"

/**
 * Numeric domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const NumericDomainModel: NumericDomain = {
  domain: NumericDomainContract,
  stability: "provisional"
}
