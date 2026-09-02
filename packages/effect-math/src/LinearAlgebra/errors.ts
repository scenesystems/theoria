/**
 * Defines tagged failures for LinearAlgebra descriptor boundaries and operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Identifies an invalid LinearAlgebra descriptor at a caller-defined domain boundary.
 *
 * @remarks
 * Current public descriptor helpers use {@link BoundaryDecodeError} and
 * {@link BoundaryEncodeError}; they do not emit this error class.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDomainBoundaryError
  extends Schema.TaggedError<LinearAlgebraDomainBoundaryError>()("LinearAlgebraDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports that a validated linear-algebra operation could not decode its input.
 *
 * @remarks
 * `operation` identifies the requested calculation. `message` contains Effect
 * Schema's report for missing, excess, or invalid fields.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDecodeError
  extends Schema.TaggedError<LinearAlgebraDecodeError>()("LinearAlgebraDecodeError", {
    /** Public linear-algebra operation whose input failed decoding. */
    operation: Schema.String,
    /** Effect Schema issue report for the rejected input. */
    message: Schema.String
  })
{}

/**
 * Reports incompatible linear-algebra operand dimensions.
 *
 * @remarks
 * Validated dot, matvec, and transpose operations emit this error after
 * successful decoding. `expected` and `actual` contain human-readable shape
 * descriptions suitable for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class ShapeMismatchError extends Schema.TaggedError<ShapeMismatchError>()("ShapeMismatchError", {
  /** Linear-algebra operation that compared incompatible dimensions. */
  operation: Schema.String,
  /** Required operand shape or dimensionality. */
  expected: Schema.String,
  /** Shape or dimensionality found in the rejected operand. */
  actual: Schema.String,
  /** Diagnostic combining the operation and shape details. */
  message: Schema.String
}) {}

/**
 * Describes a singular solve for callers extending the operation error union.
 *
 * @remarks
 * Current public solve operations return `Option.none()` and do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class SingularMatrixError extends Schema.TaggedError<SingularMatrixError>()("SingularMatrixError", {
  /** Solve operation that encountered the singular matrix. */
  operation: Schema.String,
  /** Diagnostic describing the failed solve condition. */
  message: Schema.String
}) {}

/**
 * Describes a failed matrix decomposition for callers extending the operation error union.
 *
 * @remarks
 * Current public decomposition and solve operations return `Option.none()` and
 * do not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class DecompositionError extends Schema.TaggedError<DecompositionError>()("DecompositionError", {
  /** Matrix operation whose decomposition failed. */
  operation: Schema.String,
  /** Diagnostic describing the failed decomposition condition. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite dot product or norm rejected by strict precision.
 *
 * @remarks
 * Relaxed precision returns the non-finite value without this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class LinearAlgebraDomainViolationError
  extends Schema.TaggedError<LinearAlgebraDomainViolationError>()("LinearAlgebraDomainViolationError", {
    /** Strict-policy operation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Groups failures that can occur while decoding or encoding a LinearAlgebra descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export type LinearAlgebraBoundaryError = LinearAlgebraDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Groups typed failures declared for LinearAlgebra operations.
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
