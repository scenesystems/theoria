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
 * Reports failure to validate the Special-functions descriptor at an orchestration boundary.
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
 * Reports a non-finite special-function approximation rejected by strict precision.
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
 * Descriptor-level failures to recover before special-function capability
 * registration, separate from a failed function evaluation.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialBoundaryError = SpecialDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Evaluation failures recoverable by correcting decoded input or mathematical
 * parameters, or by relaxing strict finite-result policy.
 *
 * @since 0.1.0
 * @category errors
 */
export type SpecialOperationError =
  | SpecialDecodeError
  | SpecialDomainViolationError
  | SpecialParameterError
