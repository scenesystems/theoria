/**
 * Expected validation failure from search-space declaration or compilation.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * Reports a structural or distribution invariant rejected during space compilation.
 * `dimension` identifies the responsible parameter when the failure is local to one field.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidSearchSpace extends Schema.TaggedError<InvalidSearchSpace>()(
  "effect-search/InvalidSearchSpace",
  {
    /** Human-readable invariant rejected by declaration or compilation. */
    reason: Schema.String,
    /** Parameter name responsible for a dimension-local failure. */
    dimension: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
