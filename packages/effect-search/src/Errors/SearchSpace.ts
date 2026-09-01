/**
 * Tagged error variant for invalid search space declarations such as missing or malformed dimension metadata.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { SearchErrorTypeId } from "./typeId.js"

/**
 * Rejects search-space declaration or compilation when structural or
 * distribution invariants fail. `reason` describes the correction and optional
 * `dimension` identifies the parameter responsible for the failure.
 *
 * @since 0.1.0
 * @category errors
 */
export class InvalidSearchSpace extends Schema.TaggedError<InvalidSearchSpace>()(
  "effect-search/InvalidSearchSpace",
  {
    reason: Schema.String,
    dimension: Schema.optional(Schema.String)
  }
) {
  /** @since 0.1.0 */
  readonly [SearchErrorTypeId]: typeof SearchErrorTypeId = SearchErrorTypeId
}
