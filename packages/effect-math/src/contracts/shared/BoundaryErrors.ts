/**
 * Defines common failures for domain descriptor encoding and decoding.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Reports that unknown input failed a public domain Schema.
 *
 * @remarks
 * `domain` names the package domain, `contract` names the Schema, and
 * `message` contains the underlying parse issue.
 *
 * @since 0.1.0
 * @category errors
 */
export class BoundaryDecodeError extends Schema.TaggedError<BoundaryDecodeError>()("BoundaryDecodeError", {
  /** Mathematical package domain whose descriptor was rejected. */
  domain: Schema.String,
  /** Public Schema name used for the decode attempt. */
  contract: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports that a typed domain value could not be encoded by its public Schema.
 *
 * @remarks
 * This usually indicates a value forged outside the decoded type. `domain`
 * and `contract` identify the failed boundary; `message` contains the
 * underlying encode issue.
 *
 * @since 0.1.0
 * @category errors
 */
export class BoundaryEncodeError extends Schema.TaggedError<BoundaryEncodeError>()("BoundaryEncodeError", {
  /** Mathematical package domain whose descriptor could not be encoded. */
  domain: Schema.String,
  /** Public Schema name used for the encode attempt. */
  contract: Schema.String,
  /** Effect Schema issue report for the rejected typed value. */
  message: Schema.String
}) {}
