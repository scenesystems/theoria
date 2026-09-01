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
 * Reports failure to validate the Probability descriptor before density, CDF,
 * or entropy orchestration begins.
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
 * Reports rejected boundary input for a probability or entropy operation.
 *
 * @remarks
 * `operation` identifies the attempted calculation and `message` preserves the
 * rendered Schema issue for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class ProbabilityDecodeError extends Schema.TaggedError<ProbabilityDecodeError>()("ProbabilityDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Reports a non-finite probability or entropy result rejected by strict precision.
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
 * Reports invalid parameters for the lightweight normal or uniform helpers,
 * such as non-positive sigma or an unordered interval.
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
 * Descriptor-level failures to recover before Probability capability
 * registration; they do not represent a failed density, CDF, or entropy call.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilityBoundaryError = ProbabilityDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Evaluation failures recoverable by correcting boundary input or distribution
 * parameters, or by relaxing strict finite-result policy.
 *
 * @since 0.1.0
 * @category errors
 */
export type ProbabilityOperationError =
  | ProbabilityDecodeError
  | ProbabilityDomainViolationError
  | ProbabilityParameterError
