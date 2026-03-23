import { Schema } from "effect"

/**
 * Statistics boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDomainBoundaryError
  extends Schema.TaggedError<StatisticsDomainBoundaryError>()("StatisticsDomainBoundaryError", {
    message: Schema.String
  })
{}
