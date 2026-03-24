/**
 * Typed error taxonomy for the Probability domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode) and operation failures (domain violation, parameter).
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
export class ProbabilityDomainBoundaryError
  extends Schema.TaggedError<ProbabilityDomainBoundaryError>()("ProbabilityDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input contract
 * (e.g. `NormalEvalInput`, `EntropyInput`). The `operation` field names the
 * failed operation so callers can branch on it in error-recovery logic.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDecodeError extends Schema.TaggedError<ProbabilityDecodeError>()("ProbabilityDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces a
 * non-finite result (NaN or ±Infinity), or when a domain invariant is
 * violated (e.g. negative variance, probabilities outside [0,1]). Under
 * `"relaxed"` precision this error is never emitted for non-finite results.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDomainViolationError
  extends Schema.TaggedError<ProbabilityDomainViolationError>()("ProbabilityDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Raised when distribution parameters are invalid — for example, sigma ≤ 0
 * for a normal distribution, or low ≥ high for a uniform distribution.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityParameterError
  extends Schema.TaggedError<ProbabilityParameterError>()("ProbabilityParameterError", {
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
export type ProbabilityBoundaryError = ProbabilityDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all errors that can arise from within a probability operation
 * (after boundary decode succeeds). Useful as a unified error channel type
 * for combinators that orchestrate multiple operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilityOperationError =
  | ProbabilityDecodeError
  | ProbabilityDomainViolationError
  | ProbabilityParameterError
