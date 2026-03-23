import { Schema } from "effect"

/**
 * Shared boundary decode failure for public contract edges.
 *
 * @since 0.1.0
 * @category errors
 */
export class BoundaryDecodeError extends Schema.TaggedError<BoundaryDecodeError>()("BoundaryDecodeError", {
  domain: Schema.String,
  contract: Schema.String,
  message: Schema.String
}) {}

/**
 * Shared boundary encode failure for public contract edges.
 *
 * @since 0.1.0
 * @category errors
 */
export class BoundaryEncodeError extends Schema.TaggedError<BoundaryEncodeError>()("BoundaryEncodeError", {
  domain: Schema.String,
  contract: Schema.String,
  message: Schema.String
}) {}
