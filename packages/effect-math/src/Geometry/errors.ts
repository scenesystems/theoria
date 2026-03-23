import { Schema } from "effect"

/**
 * Geometry boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class GeometryDomainBoundaryError
  extends Schema.TaggedError<GeometryDomainBoundaryError>()("GeometryDomainBoundaryError", {
    message: Schema.String
  })
{}
