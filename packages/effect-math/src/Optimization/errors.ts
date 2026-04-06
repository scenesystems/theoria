/**
 * Typed error taxonomy for the Optimization domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode/encode) and operation failures (decode, domain
 * violation, invalid parameters, convergence).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { KernelExecutionError } from "../contracts/shared/AdvancedComputationErrors.js"
import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDomainBoundaryError
  extends Schema.TaggedError<OptimizationDomainBoundaryError>()("OptimizationDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input
 * contract (e.g. `BisectInput`, `GoldenSectionInput`). The `operation`
 * field names the failed operation for error-recovery branching.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDecodeError extends Schema.TaggedError<OptimizationDecodeError>()(
  "OptimizationDecodeError",
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces
 * a non-finite result (NaN or ±Infinity). Under `"relaxed"` precision
 * this error is never emitted.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationDomainViolationError
  extends Schema.TaggedError<OptimizationDomainViolationError>()("OptimizationDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when mathematical parameters are invalid for the requested
 * operation — for example, bisect with f(a) and f(b) having the same sign.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationParameterError
  extends Schema.TaggedError<OptimizationParameterError>()("OptimizationParameterError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when an iterative solver fails to converge within the
 * allowed iteration budget.
 *
 * @since 0.1.0
 * @category errors
 */
export class OptimizationConvergenceError
  extends Schema.TaggedError<OptimizationConvergenceError>()("OptimizationConvergenceError", {
    operation: Schema.String,
    message: Schema.String,
    iterations: Schema.Number
  })
{}

/**
 * Raised when a root-finding workflow requires derivative authority that
 * is either unavailable or becomes numerically singular at runtime.
 *
 * @since 0.3.0
 * @category errors
 */
export class OptimizationDerivativeAuthorityError
  extends Schema.TaggedError<OptimizationDerivativeAuthorityError>()("OptimizationDerivativeAuthorityError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Union of all boundary-level errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationBoundaryError = OptimizationDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all operation-level errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationOperationError =
  | OptimizationDecodeError
  | OptimizationDomainViolationError
  | OptimizationParameterError
  | OptimizationConvergenceError
  | OptimizationDerivativeAuthorityError
  | KernelExecutionError
