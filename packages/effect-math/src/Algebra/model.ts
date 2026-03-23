import { AlgebraDomainContract } from "./contract.js"
import type { AlgebraDomain } from "./schema.js"

/**
 * Algebra domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const AlgebraDomainModel: AlgebraDomain = {
  domain: AlgebraDomainContract,
  stability: "provisional"
}
