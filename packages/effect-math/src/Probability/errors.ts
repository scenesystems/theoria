import { Schema } from "effect"

/**
 * Probability boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDomainBoundaryError
  extends Schema.TaggedError<ProbabilityDomainBoundaryError>()("ProbabilityDomainBoundaryError", {
    message: Schema.String
  })
{}
