/**
 * Defines the LinearAlgebra descriptor used by domain discovery.
 *
 * @since 0.1.0
 * @category models
 */
import { LinearAlgebraDomainContract } from "./contract.js"
import { LinearAlgebraDomain } from "./schema.js"

/**
 * Classifies the LinearAlgebra domain as provisional in discovery results.
 *
 * @since 0.1.0
 * @category models
 */
export const LinearAlgebraDomainModel = new LinearAlgebraDomain({
  domain: LinearAlgebraDomainContract,
  stability: "provisional"
})
