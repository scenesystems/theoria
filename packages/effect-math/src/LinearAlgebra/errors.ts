import { Schema } from "effect"

/**
 * LinearAlgebra boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDomainBoundaryError
  extends Schema.TaggedError<LinearAlgebraDomainBoundaryError>()("LinearAlgebraDomainBoundaryError", {
    message: Schema.String
  })
{}
