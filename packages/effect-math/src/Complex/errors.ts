/**
 * Typed error taxonomy for complex number operations.
 *
 * Every error is a `Schema.TaggedError` enabling `catchTag` pattern
 * matching in Effect pipelines and lossless serialization across
 * boundaries.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation — typically from `decodeComplexDomain`
 * or `encodeComplexDomain` at the package boundary.
 *
 * @see {@link ComplexDecodeError} — per-operation decode failure
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainBoundaryError
  extends Schema.TaggedError<ComplexDomainBoundaryError>()("ComplexDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input
 * contract. The `operation` field names the failed function so
 * callers can provide targeted error messages.
 *
 * @see {@link ComplexDomainBoundaryError} — boundary-level failure
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDecodeError extends Schema.TaggedError<ComplexDecodeError>()("ComplexDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised on division by zero in complex arithmetic — when the divisor
 * has both real and imaginary parts equal to zero.
 *
 * @see {@link ComplexDomainError} — general domain violations
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDivisionByZeroError
  extends Schema.TaggedError<ComplexDivisionByZeroError>()("ComplexDivisionByZeroError", {
    message: Schema.String
  })
{}

/**
 * Raised when a complex operation receives input outside its
 * mathematical domain — for example, `log(0)` or branch-cut
 * ambiguities in multi-valued functions.
 *
 * @see {@link ComplexDivisionByZeroError} — specific zero-divisor case
 * @see {@link ComplexDomainViolationError} — policy-driven rejection
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainError extends Schema.TaggedError<ComplexDomainError>()("ComplexDomainError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under `"strict"` precision policy when an operation produces
 * a non-finite result (NaN or ±Infinity). Never emitted under
 * `"relaxed"` precision.
 *
 * @see {@link ComplexDomainError} — mathematical domain violations
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainViolationError
  extends Schema.TaggedError<ComplexDomainViolationError>()("ComplexDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Union of all boundary-level errors that can occur during domain
 * schema decode/encode at the package boundary.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexBoundaryError = ComplexDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all operation-level errors that can occur during complex
 * arithmetic, trigonometric, or analysis computations.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexOperationError =
  | ComplexDecodeError
  | ComplexDivisionByZeroError
  | ComplexDomainError
  | ComplexDomainViolationError
