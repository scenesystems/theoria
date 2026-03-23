import { Schema } from "effect"

import { DomainStability } from "../contracts/shared/DomainStability.js"

/**
 * Geometry schema authority scaffold.
 *
 * @since 0.1.0
 * @category schemas
 */
export const GeometryDomainSchema = Schema.Struct({
  domain: Schema.Literal("Geometry"),
  stability: DomainStability
})

/**
 * Geometry schema-derived type.
 *
 * @since 0.1.0
 * @category models
 */
export type GeometryDomain = typeof GeometryDomainSchema.Type
