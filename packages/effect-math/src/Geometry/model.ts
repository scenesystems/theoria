/**
 * Publishes the Geometry discovery descriptor with provisional stability.
 *
 * @since 0.1.0
 * @category models
 */
import { GeometryDomainContract } from "./contract.js"
import type { GeometryDomain } from "./schema.js"

/**
 * Metadata identifying the Geometry API as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const GeometryDomainModel: GeometryDomain = {
  domain: GeometryDomainContract,
  stability: "provisional"
}
