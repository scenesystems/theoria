/**
 * Defines typed failures for Special boundary and calculation operations.
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
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports input rejected by a validated special-function operation.
 * `operation` identifies the attempted calculation and `message` preserves
 * the rendered Schema issue.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialDecodeError extends Schema.TaggedError<SpecialDecodeError>()("SpecialDecodeError", {
  /** Public special-function operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
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
    /** Strict-policy operation that produced a non-finite approximation. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Describes mathematical parameters outside a special function's domain.
 *
 * @remarks
 * Current public operations use `SpecialDecodeError` for validated parameter
 * rejection and do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class SpecialParameterError extends Schema.TaggedError<SpecialParameterError>()("SpecialParameterError", {
  /** Special-function operation whose parameters fall outside its mathematical domain. */
  operation: Schema.String,
  /** Diagnostic identifying the rejected parameter condition. */
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
