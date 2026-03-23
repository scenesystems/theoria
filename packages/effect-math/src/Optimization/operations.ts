import { Effect } from "effect"

import { OptimizationDomainModel } from "./model.js"

/**
 * Optimization operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadOptimizationDomain = Effect.succeed(OptimizationDomainModel)
