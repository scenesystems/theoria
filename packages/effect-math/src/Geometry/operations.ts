import { Effect } from "effect"

import { GeometryDomainModel } from "./model.js"

/**
 * Geometry operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadGeometryDomain = Effect.succeed(GeometryDomainModel)
