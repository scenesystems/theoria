/**
 * Publishes the LinearAlgebra discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { LinearAlgebraDomainContract } from "./contract.js"
import type { LinearAlgebraDomain } from "./schema.js"

/**
 * Metadata identifying the LinearAlgebra API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const LinearAlgebraDomainModel: LinearAlgebraDomain = {
  domain: LinearAlgebraDomainContract,
  stability: "provisional"
}
