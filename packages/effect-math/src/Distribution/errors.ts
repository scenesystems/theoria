/**
 * Typed error taxonomy for the Distribution domain. Each error is a
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
 * Reports failure to validate the Distribution catalog descriptor before
 * selecting a distribution family.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDomainBoundaryError
  extends Schema.TaggedError<DistributionDomainBoundaryError>()("DistributionDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Raised when Schema decode fails for a specific operation's input contract.
 * The `operation` field names the failed operation so callers can branch on
 * it in error-recovery logic.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDecodeError extends Schema.TaggedError<DistributionDecodeError>()("DistributionDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Reports a non-finite density, mass, CDF, or quantile rejected by strict precision.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDomainViolationError
  extends Schema.TaggedError<DistributionDomainViolationError>()("DistributionDomainViolationError", {
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
export class DistributionParameterError
  extends Schema.TaggedError<DistributionParameterError>()("DistributionParameterError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Catalog-descriptor failures to recover before distribution-family discovery
 * or registration, rather than failures evaluating a distribution.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionBoundaryError = DistributionDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Evaluation failures callers can recover from by correcting input shape or
 * family parameters, or by relaxing strict finite-result policy.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionOperationError =
  | DistributionDecodeError
  | DistributionDomainViolationError
  | DistributionParameterError
