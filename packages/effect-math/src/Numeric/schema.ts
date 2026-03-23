import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Numeric schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NumericDomainSchema = Schema.Struct({
  domain: Schema.Literal("Numeric"),
  stability: DomainStability
})

/**
 * Numeric schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericDomain = typeof NumericDomainSchema.Type
