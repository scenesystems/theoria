import { Effect } from "effect"

import { LinearAlgebraDomainModel } from "./model.js"

/**
 * LinearAlgebra operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadLinearAlgebraDomain = Effect.succeed(LinearAlgebraDomainModel)
