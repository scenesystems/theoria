import { Effect } from "effect"

import { StatisticsDomainModel } from "./model.js"

/**
 * Statistics operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadStatisticsDomain = Effect.succeed(StatisticsDomainModel)
