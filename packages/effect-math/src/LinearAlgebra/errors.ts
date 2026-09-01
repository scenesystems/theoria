/**
 * Typed error taxonomy for the LinearAlgebra domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode/encode) and operation failures (shape, singularity,
 * decomposition, domain violation).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation. Use this as a catch-all for validation
 * pipelines that span multiple operations within the domain.
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
 * Reports rejected boundary input for a linear-algebra operation.
 *
 * @remarks
 * `operation` identifies the attempted calculation and `message` preserves the
 * rendered Schema issue for diagnostics.
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
 * Reports incompatible linear-algebra operand dimensions.
 *
 * @remarks
 * Raised, for example, for a dot product of vectors with different lengths or
 * a matvec where the vector length does not equal the column count. The
 * `expected` and `actual` fields carry human-readable dimension strings (for
 * example, `"length 3"` versus `"length 5"`) for diagnostic messages.
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
 * Reserved singular-matrix failure channel. Public solve kernels represent a
 * failed solve with `Option.none()` and do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class SingularMatrixError extends Schema.TaggedError<SingularMatrixError>()("SingularMatrixError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Reserved decomposition failure channel. Public Cholesky and SPD solve kernels
 * represent invalid shape, asymmetry, or failed pivots with `Option.none()` and
 * do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecompositionError extends Schema.TaggedError<DecompositionError>()("DecompositionError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces a
 * non-finite result (NaN or ±Infinity). Policy-aware scalar operations pass
 * non-finite results through under `"relaxed"` precision.
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
 * Union of all boundary-level errors that can arise from domain validation,
 * Schema decode, or Schema encode at the package edge. Use as the error
 * channel type for boundary-crossing pipelines.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraBoundaryError = LinearAlgebraDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all errors that can arise from within a linear-algebra operation
 * (after boundary decode succeeds). Useful as a unified error channel type
 * for combinators that orchestrate multiple operations.
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
