/**
 * Defines tagged failures for Calculus descriptor boundaries and operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { KernelExecutionError } from "../contracts/shared/AdvancedComputationErrors.js"
import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Identifies an invalid Calculus descriptor at a caller-defined domain boundary.
 *
 * @remarks
 * Current public descriptor helpers use {@link BoundaryDecodeError} and
 * {@link BoundaryEncodeError}; they do not emit this error class.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDomainBoundaryError
  extends Schema.TaggedError<CalculusDomainBoundaryError>()("CalculusDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports that a validated calculus operation could not decode its input.
 *
 * @remarks
 * `operation` names the requested calculation. `message` contains Effect
 * Schema's report for missing, excess, or invalid fields.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDecodeError extends Schema.TaggedError<CalculusDecodeError>()("CalculusDecodeError", {
  /** Public calculation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite calculus result rejected by strict precision.
 *
 * @remarks
 * Estimate policies also require a finite `absoluteError`. Relaxed precision
 * does not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusDomainViolationError
  extends Schema.TaggedError<CalculusDomainViolationError>()("CalculusDomainViolationError", {
    /** Strict-policy calculation that produced a non-finite estimate or error bound. */
    operation: Schema.String,
    /** Diagnostic identifying the rejected result. */
    message: Schema.String
  })
{}

/**
 * Reports incompatible dimensions for a validated multivariate operation.
 *
 * @remarks
 * Current public operations emit this error when a directional derivative has
 * unequal vector lengths or a divergence field returns the wrong dimension.
 * Sample and step-size failures use {@link CalculusDecodeError}.
 *
 * @since 0.1.0
 * @category errors
 */
export class CalculusParameterError extends Schema.TaggedError<CalculusParameterError>()("CalculusParameterError", {
  /** Multivariate calculation whose decoded dimensions are incompatible. */
  operation: Schema.String,
  /** Diagnostic describing the required and observed dimensions. */
  message: Schema.String
}) {}

/**
 * Groups failures that can occur while decoding or encoding a Calculus descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusBoundaryError = CalculusDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Groups typed failures from validated and policy-aware Calculus operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type CalculusOperationError =
  | CalculusDecodeError
  | CalculusDomainViolationError
  | CalculusParameterError
  | KernelExecutionError
