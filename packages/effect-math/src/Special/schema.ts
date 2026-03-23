import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Special schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SpecialDomainSchema = Schema.Struct({
  domain: Schema.Literal("Special"),
  stability: DomainStability
})

/**
 * Special schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type SpecialDomain = typeof SpecialDomainSchema.Type
