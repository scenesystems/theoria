/**
 * Defines typed failures for Complex boundary and calculation operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports a failed complex-domain boundary check.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainBoundaryError
  extends Schema.TaggedError<ComplexDomainBoundaryError>()("ComplexDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports malformed input to a validated complex operation. `operation`
 * identifies the operation whose schema rejected the input.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDecodeError extends Schema.TaggedError<ComplexDecodeError>()("ComplexDecodeError", {
  /** Public complex operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Describes division by a value with zero real and imaginary components.
 *
 * @remarks
 * Current public division operations preserve their IEEE 754 output and do
 * not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDivisionByZeroError
  extends Schema.TaggedError<ComplexDivisionByZeroError>()("ComplexDivisionByZeroError", {
    /** Diagnostic describing the zero divisor. */
    message: Schema.String
  })
{}

/**
 * Reports an input outside a validated complex operation's mathematical
 * domain. The pure operations instead follow their documented IEEE 754 and
 * principal-branch conventions.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainError extends Schema.TaggedError<ComplexDomainError>()("ComplexDomainError", {
  /** Validated operation whose input falls outside its mathematical domain. */
  operation: Schema.String,
  /** Diagnostic identifying the rejected domain condition. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite result rejected by the `"strict"` precision policy.
 * The `"relaxed"` policy permits that result.
 *
 * @since 0.1.0
 * @category errors
 */
export class ComplexDomainViolationError
  extends Schema.TaggedError<ComplexDomainViolationError>()("ComplexDomainViolationError", {
    /** Strict-policy operation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Descriptor-level failures to recover before registering Complex capability
 * metadata; these do not describe a failed arithmetic operation.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexBoundaryError = ComplexDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Arithmetic failures declared by the Complex package. The union includes
 * error classes that current public operations do not emit.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexOperationError =
  | ComplexDecodeError
  | ComplexDivisionByZeroError
  | ComplexDomainError
  | ComplexDomainViolationError
