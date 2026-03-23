import { Schema } from "effect"

/**
 * Numeric boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDomainBoundaryError
  extends Schema.TaggedError<NumericDomainBoundaryError>()("NumericDomainBoundaryError", {
    message: Schema.String
  })
{}
