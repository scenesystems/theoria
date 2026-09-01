/**
 * Shared boundary error types for domain contract edges.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Reports a failure to decode an external representation into a domain value.
 * `domain` and `contract` identify the boundary that rejected `message`.
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
 * Reports a failure to encode a domain value for an external representation.
 * `domain` and `contract` identify the boundary that rejected `message`.
 *
 * @since 0.1.0
 * @category errors
 */
export class BoundaryEncodeError extends Schema.TaggedError<BoundaryEncodeError>()("BoundaryEncodeError", {
  domain: Schema.String,
  contract: Schema.String,
  message: Schema.String
}) {}
