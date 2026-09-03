/**
 * Defines typed failures for Probability boundary and calculation operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports failure to validate the Probability descriptor before density, CDF,
 * or entropy orchestration begins.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDomainBoundaryError
  extends Schema.TaggedError<ProbabilityDomainBoundaryError>()("ProbabilityDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports rejected boundary input for a probability or entropy operation.
 *
 * @remarks
 * `operation` identifies the attempted calculation and `message` preserves the
 * rendered Schema issue for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDecodeError extends Schema.TaggedError<ProbabilityDecodeError>()("ProbabilityDecodeError", {
  /** Public probability operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite probability or entropy result rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDomainViolationError
  extends Schema.TaggedError<ProbabilityDomainViolationError>()("ProbabilityDomainViolationError", {
    /** Strict-policy operation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Reports unordered uniform bounds rejected by a validated PDF or CDF
 * operation. Invalid normal scale is reported as `ProbabilityDecodeError`
 * because the normal input schema requires a positive value.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityParameterError
  extends Schema.TaggedError<ProbabilityParameterError>()("ProbabilityParameterError", {
    /** Validated probability operation whose bounds are not strictly ordered. */
    operation: Schema.String,
    /** Diagnostic identifying the rejected bound relationship. */
    message: Schema.String
  })
{}

/**
 * Descriptor-level failures to recover before Probability capability
 * registration; they do not represent a failed density, CDF, or entropy call.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilityBoundaryError = ProbabilityDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Evaluation failures recoverable by correcting boundary input or distribution
 * parameters, or by relaxing strict finite-result policy.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilityOperationError =
  | ProbabilityDecodeError
  | ProbabilityDomainViolationError
  | ProbabilityParameterError
