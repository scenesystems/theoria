/**
 * Linear algebra domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { LinearAlgebraDomainContract } from "./contract.js"
import type { LinearAlgebraDomain } from "./schema.js"

/**
 * LinearAlgebra domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const LinearAlgebraDomainModel: LinearAlgebraDomain = {
  domain: LinearAlgebraDomainContract,
  stability: "provisional"
}
