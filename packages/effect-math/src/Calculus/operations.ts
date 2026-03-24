/**
 * Calculus domain operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect } from "effect"

import { CalculusDomainModel } from "./model.js"

/**
 * Calculus operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadCalculusDomain = Effect.succeed(CalculusDomainModel)
