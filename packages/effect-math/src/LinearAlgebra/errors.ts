/**
 * LinearAlgebra domain typed error taxonomy.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * LinearAlgebra boundary failure for validation orchestration.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDomainBoundaryError
  extends Schema.TaggedError<LinearAlgebraDomainBoundaryError>()("LinearAlgebraDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * LinearAlgebra decode failure at a public contract edge.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDecodeError
  extends Schema.TaggedError<LinearAlgebraDecodeError>()("LinearAlgebraDecodeError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Shape mismatch — dimension incompatibility between operands.
 *
 * @since 0.1.0
 * @category errors
 */
export class ShapeMismatchError extends Schema.TaggedError<ShapeMismatchError>()("ShapeMismatchError", {
  operation: Schema.String,
  expected: Schema.String,
  actual: Schema.String,
  message: Schema.String
}) {}

/**
 * Singular matrix — operation requires a non-singular matrix.
 *
 * @since 0.1.0
 * @category errors
 */
export class SingularMatrixError extends Schema.TaggedError<SingularMatrixError>()("SingularMatrixError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Decomposition failure — factorization could not be completed.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecompositionError extends Schema.TaggedError<DecompositionError>()("DecompositionError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Domain violation — e.g. non-finite values in a matrix operation.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDomainViolationError
  extends Schema.TaggedError<LinearAlgebraDomainViolationError>()("LinearAlgebraDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * LinearAlgebra boundary errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraBoundaryError = LinearAlgebraDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * All linear-algebra operation errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraOperationError =
  | LinearAlgebraDecodeError
  | ShapeMismatchError
  | SingularMatrixError
  | DecompositionError
  | LinearAlgebraDomainViolationError
