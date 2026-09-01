/**
 * Typed error taxonomy for the Algebra domain. Each error is a
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
 * Reports failure to validate the Algebra domain descriptor at an orchestration boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraDomainBoundaryError
  extends Schema.TaggedError<AlgebraDomainBoundaryError>()("AlgebraDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input
 * contract (e.g. `PolyEvalInput`, `GcdInput`). The `operation` field names
 * the failed operation for error-recovery branching.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraDecodeError extends Schema.TaggedError<AlgebraDecodeError>()("AlgebraDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Reports a non-finite polynomial or integer-operation result rejected by
 * strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraDomainViolationError
  extends Schema.TaggedError<AlgebraDomainViolationError>()("AlgebraDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when mathematical parameters are invalid for the requested
 * operation — for example, factorial of a negative number.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraParameterError extends Schema.TaggedError<AlgebraParameterError>()("AlgebraParameterError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Descriptor-level failures to recover before capability registration: a
 * rejected domain contract or failed wire decode/encode.
 *
 * @since 0.1.0
 * @category errors
 */
export type AlgebraBoundaryError = AlgebraDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Calculation-level failures callers can recover from by correcting operation
 * input or parameters, or by choosing a less restrictive precision policy.
 *
 * @since 0.1.0
 * @category errors
 */
export type AlgebraOperationError =
  | AlgebraDecodeError
  | AlgebraDomainViolationError
  | AlgebraParameterError
