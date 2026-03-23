import { Schema } from "effect"

/**
 * Algebra boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraDomainBoundaryError
  extends Schema.TaggedError<AlgebraDomainBoundaryError>()("AlgebraDomainBoundaryError", {
    message: Schema.String
  })
{}
