/**
 * Defines typed failures for Algebra boundary and calculation operations.
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
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports input rejected by a validated Algebra operation. `operation`
 * identifies the calculation and `message` contains the schema diagnostic.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraDecodeError extends Schema.TaggedError<AlgebraDecodeError>()("AlgebraDecodeError", {
  /** Public calculation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
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
    /** Strict-policy calculation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Reports mathematical parameters rejected after input decoding, such as a
 * negative factorial operand.
 *
 * @since 0.1.0
 * @category errors
 */
export class AlgebraParameterError extends Schema.TaggedError<AlgebraParameterError>()("AlgebraParameterError", {
  /** Calculation whose decoded parameters violate a mathematical precondition. */
  operation: Schema.String,
  /** Diagnostic identifying the failed parameter condition. */
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
