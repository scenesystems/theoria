/**
 * Special-functions domain error types.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

/**
 * Special boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialDomainBoundaryError
  extends Schema.TaggedError<SpecialDomainBoundaryError>()("SpecialDomainBoundaryError", {
    message: Schema.String
  })
{}
