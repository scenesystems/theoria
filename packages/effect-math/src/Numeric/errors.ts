/**
 * Numeric domain typed error taxonomy.
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
  operation: Schema.String,
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
  operation: Schema.String,
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
    operation: Schema.String,
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
    operation: Schema.String,
    conditionNumber: Schema.Number,
    threshold: Schema.Number,
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
  operation: Schema.String,
  iterations: Schema.Number,
  residual: Schema.Number,
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
