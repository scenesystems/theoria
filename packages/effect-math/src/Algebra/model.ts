/**
 * Defines the canonical Algebra discovery descriptor.
 *
 * @since 0.1.0
 * @category models
 */
import { AlgebraDomainContract } from "./contract.js"
import type { AlgebraDomain } from "./schema.js"

/**
 * Identifies the Algebra domain as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const AlgebraDomainModel: AlgebraDomain = {
  domain: AlgebraDomainContract,
  stability: "provisional"
}
