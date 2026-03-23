import { Effect } from "effect"

import { AlgebraDomainModel } from "./model.js"

/**
 * Algebra operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadAlgebraDomain = Effect.succeed(AlgebraDomainModel)
