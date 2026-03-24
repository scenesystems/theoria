/**
 * Special-functions domain operations.
 *
 * @since 0.1.0
 * @category operations
 */
import { Effect } from "effect"

import { SpecialDomainModel } from "./model.js"

/**
 * Special operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadSpecialDomain = Effect.succeed(SpecialDomainModel)
