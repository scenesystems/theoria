/**
 * Defines typed failures for Numeric boundary and calculation operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { AbsoluteTolerance, IterationBudget } from "../contracts/shared/BrandedScalars.js"

/**
 * Reports a failed numeric domain boundary check.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDomainBoundaryError
  extends Schema.TaggedError<NumericDomainBoundaryError>()("NumericDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports malformed input to a validated numeric operation. `operation`
 * identifies the operation whose schema rejected the input; `message`
 * contains the schema diagnostic.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDecodeError extends Schema.TaggedError<NumericDecodeError>()("NumericDecodeError", {
  /** Public numeric operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports a shape invariant that cannot be expressed by the input schema.
 * `operation` identifies the rejected operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericShapeError extends Schema.TaggedError<NumericShapeError>()("NumericShapeError", {
  /** Numeric operation whose decoded inputs violate a shape invariant. */
  operation: Schema.String,
  /** Diagnostic describing the incompatible shape. */
  message: Schema.String
}) {}

/**
 * Reports an input or result outside an operation's mathematical domain.
 * Consult the operation documentation for the exact rejected domain.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDomainViolationError
  extends Schema.TaggedError<NumericDomainViolationError>()("NumericDomainViolationError", {
    /** Numeric operation whose input or result falls outside its domain. */
    operation: Schema.String,
    /** Diagnostic identifying the rejected domain condition. */
    message: Schema.String
  })
{}

/**
 * Reports that `conditionNumber` exceeded the accepted `threshold` for
 * `operation`.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericConditioningError
  extends Schema.TaggedError<NumericConditioningError>()("NumericConditioningError", {
    /** Numerical operation whose conditioning was checked. */
    operation: Schema.String,
    /** Estimated sensitivity of the result to input perturbation. */
    conditionNumber: Schema.Number,
    /** Largest condition number accepted by the operation. */
    threshold: Schema.Number,
    /** Diagnostic recording the failed conditioning comparison. */
    message: Schema.String
  })
{}

/**
 * Reports that `operation` did not converge, including the completed
 * iteration count and final residual.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericConvergenceError extends Schema.TaggedError<NumericConvergenceError>()("NumericConvergenceError", {
  /** Iterative operation that did not satisfy its stopping criterion. */
  operation: Schema.String,
  /** Iterations completed before termination. */
  iterations: Schema.Number,
  /** Final error measure compared with the convergence tolerance. */
  residual: Schema.Number,
  /** Diagnostic recording the final convergence state. */
  message: Schema.String
}) {}

/**
 * Schema for a finite value sequence, non-negative absolute tolerance, and
 * positive integer iteration budget.
 *
 * @since 0.1.0
 * @category contracts
 */
export const NumericBoundaryValidationInput = Schema.Struct({
  values: Schema.Array(Schema.Number.pipe(Schema.finite())),
  tolerance: AbsoluteTolerance,
  budget: IterationBudget
})

/**
 * Records whether finite values, tolerance, and iteration-budget validation succeeded.
 *
 * @since 0.1.0
 * @category models
 */
export const NumericBoundaryValidationResult = Schema.Struct({
  ok: Schema.Boolean
})

/**
 * The decoded Boolean validation outcome returned by the numeric boundary validator.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericBoundaryValidation = typeof NumericBoundaryValidationResult.Type

/**
 * Descriptor-level failures to recover before Numeric capability registration,
 * separate from validation or convergence of a calculation.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericBoundaryError = NumericDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Calculation failures distinguishing malformed or incompatible input,
 * mathematical-domain and conditioning rejection, and non-convergence.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericOperationError =
  | NumericDecodeError
  | NumericShapeError
  | NumericDomainViolationError
  | NumericConditioningError
  | NumericConvergenceError
