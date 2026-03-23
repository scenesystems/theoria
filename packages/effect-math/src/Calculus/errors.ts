import { Schema } from "effect"

/**
 * Calculus boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDomainBoundaryError
  extends Schema.TaggedError<CalculusDomainBoundaryError>()("CalculusDomainBoundaryError", {
    message: Schema.String
  })
{}
