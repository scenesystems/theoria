import { Schema } from "effect"

/**
 * Optimization boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDomainBoundaryError
  extends Schema.TaggedError<OptimizationDomainBoundaryError>()("OptimizationDomainBoundaryError", {
    message: Schema.String
  })
{}
