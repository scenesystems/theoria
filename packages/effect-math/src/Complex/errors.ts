/**
 * Typed error taxonomy for complex number operations.
 *
 * Each class has a stable `_tag` for Effect error-channel matching.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports a failed complex-domain boundary check.
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
 * Reports malformed input to a validated complex operation. `operation`
 * identifies the operation whose schema rejected the input.
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
 * Represents a rejected divisor whose real and imaginary components are
 * both zero.
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
 * Reports an input outside a validated complex operation's mathematical
 * domain. The pure operations instead follow their documented IEEE 754 and
 * principal-branch conventions.
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
 * Reports a non-finite result rejected by the `"strict"` precision policy.
 * The `"relaxed"` policy permits that result.
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
 * Descriptor-level failures to recover before registering Complex capability
 * metadata; these do not describe a failed arithmetic operation.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexBoundaryError = ComplexDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Arithmetic-level failures distinguishing malformed input, a zero divisor,
 * mathematical-domain rejection, and strict-policy rejection.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComplexOperationError =
  | ComplexDecodeError
  | ComplexDivisionByZeroError
  | ComplexDomainError
  | ComplexDomainViolationError
