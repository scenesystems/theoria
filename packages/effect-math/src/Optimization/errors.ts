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

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports failure to validate the Optimization domain descriptor at an orchestration boundary.
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
 * Reports a non-finite root or minimizer estimate rejected by strict precision.
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
 * Reserved invalid-parameter channel for optimization algorithms. Validated
 * bisection and golden-section inputs instead fail with
 * {@link OptimizationDecodeError}; neither operation emits this error.
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
 * Reserved non-convergence channel. Bisection and golden-section return their
 * latest midpoint when the iteration budget is exhausted and do not emit it.
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
 * Descriptor-level failures to recover before optimizer discovery or
 * registration, rather than failures from running an optimizer.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationBoundaryError = OptimizationDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Workflow-level recovery channel for malformed input or strict-policy
 * rejection, plus reserved parameter and convergence failures for algorithms
 * that report those conditions.
 *
 * @since 0.1.0
 * @category errors
 */
export type OptimizationOperationError =
  | OptimizationDecodeError
  | OptimizationDomainViolationError
  | OptimizationParameterError
  | OptimizationConvergenceError
