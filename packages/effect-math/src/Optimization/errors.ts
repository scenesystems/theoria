/**
 * Defines tagged failures for Optimization descriptor boundaries and operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Identifies an invalid Optimization descriptor at a caller-defined domain boundary.
 *
 * @remarks
 * Current public descriptor helpers use {@link BoundaryDecodeError} and
 * {@link BoundaryEncodeError}; they do not emit this error class.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDomainBoundaryError
  extends Schema.TaggedError<OptimizationDomainBoundaryError>()("OptimizationDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports that a validated optimization operation could not decode its settings.
 *
 * @remarks
 * `operation` names the selected algorithm. `message` contains Effect Schema's
 * report for missing, excess, or invalid fields.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDecodeError extends Schema.TaggedError<OptimizationDecodeError>()(
  "OptimizationDecodeError",
  {
    /** Optimization algorithm whose settings failed decoding. */
    operation: Schema.String,
    /** Effect Schema issue report for the rejected settings. */
    message: Schema.String
  }
) {}

/**
 * Reports a non-finite estimate rejected by strict precision.
 *
 * @remarks
 * `operation` identifies the policy-aware algorithm. `message` records the
 * rejected estimate. Relaxed precision does not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDomainViolationError
  extends Schema.TaggedError<OptimizationDomainViolationError>()("OptimizationDomainViolationError", {
    /** Strict-policy algorithm that produced a non-finite estimate. */
    operation: Schema.String,
    /** Diagnostic containing the rejected estimate or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Describes an invalid algorithm parameter for callers extending the operation error union.
 *
 * @remarks
 * Current public operations do not emit this error. Validated settings fail
 * with {@link OptimizationDecodeError}.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationParameterError
  extends Schema.TaggedError<OptimizationParameterError>()("OptimizationParameterError", {
    /** Algorithm whose decoded settings violate a mathematical precondition. */
    operation: Schema.String,
    /** Diagnostic identifying the failed parameter condition. */
    message: Schema.String
  })
{}

/**
 * Describes iteration exhaustion for callers extending the operation error union.
 *
 * @remarks
 * Current public operations return their latest midpoint at the iteration
 * limit and do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationConvergenceError
  extends Schema.TaggedError<OptimizationConvergenceError>()("OptimizationConvergenceError", {
    /** Iterative algorithm that did not satisfy its stopping criterion. */
    operation: Schema.String,
    /** Diagnostic recording the final convergence state. */
    message: Schema.String,
    /** Iterations completed before termination. */
    iterations: Schema.Number
  })
{}

/**
 * Groups failures that can occur while decoding or encoding an Optimization descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationBoundaryError = OptimizationDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Groups typed failures declared for Optimization operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationOperationError =
  | OptimizationDecodeError
  | OptimizationDomainViolationError
  | OptimizationParameterError
  | OptimizationConvergenceError
