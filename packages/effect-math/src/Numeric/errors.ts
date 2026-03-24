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
 * Numeric boundary failure for validation orchestration.
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
 * Numeric decode failure at a public contract edge.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDecodeError extends Schema.TaggedError<NumericDecodeError>()("NumericDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Numeric shape violation — e.g. empty array where non-empty is required.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericShapeError extends Schema.TaggedError<NumericShapeError>()("NumericShapeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Domain violation — e.g. log of non-positive, divide by zero.
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
 * Conditioning failure — e.g. matrix condition number exceeds threshold.
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
 * Convergence failure — e.g. iteration budget exhausted.
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
 * Numeric boundary validation input contract.
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
 * Numeric boundary validation result contract.
 *
 * @since 0.1.0
 * @category models
 */
export const NumericBoundaryValidationResult = Schema.Struct({
  ok: Schema.Boolean
})

/**
 * Numeric boundary validation result model.
 *
 * @since 0.1.0
 * @category models
 */
export type NumericBoundaryValidation = typeof NumericBoundaryValidationResult.Type

/**
 * Numeric operation boundary errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericBoundaryError = NumericDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * All numeric operation errors.
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
