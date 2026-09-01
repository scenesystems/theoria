/**
 * Publishes the Algebra discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { AlgebraDomainContract } from "./contract.js"
import type { AlgebraDomain } from "./schema.js"

/**
 * Algebra domain model instance — polynomial evaluation, integer
 * arithmetic, and combinatorial operations.
 *
 * @since 0.1.0
 * @category models
 */
export const AlgebraDomainModel: AlgebraDomain = {
  domain: AlgebraDomainContract,
  stability: "provisional"
}
