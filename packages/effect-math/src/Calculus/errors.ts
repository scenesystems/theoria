/**
 * Typed error taxonomy for the Calculus domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode/encode) and operation failures (decode, domain
 * violation, invalid parameters).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { KernelExecutionError } from "../contracts/shared/AdvancedComputationErrors.js"
import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports failure to validate the Calculus domain descriptor at an orchestration boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDomainBoundaryError
  extends Schema.TaggedError<CalculusDomainBoundaryError>()("CalculusDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input
 * contract (e.g. `TrapezoidInput`, `SimpsonInput`). The `operation`
 * field names the failed operation for error-recovery branching.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDecodeError extends Schema.TaggedError<CalculusDecodeError>()("CalculusDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Reports a non-finite derivative or integral estimate rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDomainViolationError
  extends Schema.TaggedError<CalculusDomainViolationError>()("CalculusDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when mathematical parameters are invalid for the requested
 * operation — for example, empty sample arrays or non-positive step
 * sizes.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusParameterError extends Schema.TaggedError<CalculusParameterError>()("CalculusParameterError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Descriptor-level failures to recover before capability registration, rather
 * than failures from evaluating a calculus operation.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusBoundaryError = CalculusDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Evaluation failures recoverable by correcting operation input or dimensions,
 * changing precision policy, or handling a callback/kernel exception.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusOperationError =
  | CalculusDecodeError
  | CalculusDomainViolationError
  | CalculusParameterError
  | KernelExecutionError
