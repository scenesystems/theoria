import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Optimization schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizationDomainSchema = Schema.Struct({
  domain: Schema.Literal("Optimization"),
  stability: DomainStability
})

/**
 * Optimization schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type OptimizationDomain = typeof OptimizationDomainSchema.Type
