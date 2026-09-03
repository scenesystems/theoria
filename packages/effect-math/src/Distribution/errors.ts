/**
 * Defines tagged failures for Distribution descriptor boundaries and evaluated operations.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Identifies an invalid Distribution descriptor at a caller-defined domain boundary.
 *
 * @remarks
 * Current public descriptor helpers report {@link BoundaryDecodeError} and
 * {@link BoundaryEncodeError}; they do not emit this error class.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDomainBoundaryError
  extends Schema.TaggedError<DistributionDomainBoundaryError>()("DistributionDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports that a validated operation could not decode its input.
 *
 * @remarks
 * `operation` contains the public operation name. `message` contains Effect
 * Schema's parse report, including missing, excess, or invalid fields.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDecodeError extends Schema.TaggedError<DistributionDecodeError>()("DistributionDecodeError", {
  /** Public distribution operation whose input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite result rejected by a strict precision policy.
 *
 * @remarks
 * `operation` identifies the policy-aware operation. `message` records the
 * rejected result. Relaxed precision does not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionDomainViolationError
  extends Schema.TaggedError<DistributionDomainViolationError>()("DistributionDomainViolationError", {
    /** Strict-policy operation that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Reports finite uniform bounds that are not strictly ordered.
 *
 * @remarks
 * Current public operations emit this error only from
 * {@link uniformPdfValidated}. Other validated parameter failures occur during
 * schema decoding and use {@link DistributionDecodeError}.
 *
 * @since 0.1.0
 * @category errors
 */
export class DistributionParameterError
  extends Schema.TaggedError<DistributionParameterError>()("DistributionParameterError", {
    /** Validated distribution operation whose bounds are not strictly ordered. */
    operation: Schema.String,
    /** Diagnostic identifying the rejected bound relationship. */
    message: Schema.String
  })
{}

/**
 * Groups failures that can occur while decoding or encoding a Distribution descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionBoundaryError = DistributionDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Groups typed failures from validated and policy-aware Distribution operations.
 *
 * @since 0.1.0
 * @category errors
 */
export type DistributionOperationError =
  | DistributionDecodeError
  | DistributionDomainViolationError
  | DistributionParameterError
