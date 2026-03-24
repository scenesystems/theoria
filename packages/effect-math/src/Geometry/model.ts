/**
 * Geometry domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { GeometryDomainContract } from "./contract.js"
import type { GeometryDomain } from "./schema.js"

/**
 * Geometry domain model scaffold.
 *
 * @since 0.1.0
 * @category models
 */
export const GeometryDomainModel: GeometryDomain = {
  domain: GeometryDomainContract,
  stability: "stable"
}
