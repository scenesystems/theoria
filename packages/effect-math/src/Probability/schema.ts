import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Probability schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProbabilityDomainSchema = Schema.Struct({
  domain: Schema.Literal("Probability"),
  stability: DomainStability
})

/**
 * Probability schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type ProbabilityDomain = typeof ProbabilityDomainSchema.Type
