/**
 * Typed error taxonomy for the Special Functions domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode/encode) and operation failures (decode, domain
 * violation, invalid parameters).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialDomainBoundaryError
  extends Schema.TaggedError<SpecialDomainBoundaryError>()("SpecialDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input
 * contract (e.g. `GammaInput`, `BetaInput`). The `operation` field names
 * the failed operation for error-recovery branching.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialDecodeError extends Schema.TaggedError<SpecialDecodeError>()("SpecialDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces
 * a non-finite result (NaN or ±Infinity). Under `"relaxed"` precision
 * this error is never emitted.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialDomainViolationError
  extends Schema.TaggedError<SpecialDomainViolationError>()("SpecialDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when mathematical parameters are invalid for the requested
 * operation — for example, gamma at a non-positive integer pole, or beta
 * with non-positive arguments.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialParameterError extends Schema.TaggedError<SpecialParameterError>()("SpecialParameterError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Union of all boundary-level errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialBoundaryError = SpecialDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all operation-level errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialOperationError =
  | SpecialDecodeError
  | SpecialDomainViolationError
  | SpecialParameterError
