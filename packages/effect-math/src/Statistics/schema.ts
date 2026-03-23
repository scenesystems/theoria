import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Statistics schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StatisticsDomainSchema = Schema.Struct({
  domain: Schema.Literal("Statistics"),
  stability: DomainStability
})

/**
 * Statistics schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type StatisticsDomain = typeof StatisticsDomainSchema.Type
