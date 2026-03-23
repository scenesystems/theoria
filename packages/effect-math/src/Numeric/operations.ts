import { Effect } from "effect"

import { NumericDomainModel } from "./model.js"

/**
 * Numeric operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadNumericDomain = Effect.succeed(NumericDomainModel)
