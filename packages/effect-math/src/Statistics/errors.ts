/**
 * Defines tagged failures for Statistics descriptor boundaries and estimators.
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Identifies an invalid Statistics descriptor at a caller-defined domain boundary.
 *
 * @remarks
 * Current public descriptor helpers use {@link BoundaryDecodeError} and
 * {@link BoundaryEncodeError}; they do not emit this error class.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDomainBoundaryError
  extends Schema.TaggedError<StatisticsDomainBoundaryError>()("StatisticsDomainBoundaryError", {
    /** Diagnostic supplied by the boundary that rejected the descriptor. */
    message: Schema.String
  })
{}

/**
 * Reports that a validated estimator could not decode its sample input.
 *
 * @remarks
 * `operation` identifies the estimator. `message` contains Effect Schema's
 * report for missing, excess, empty, or non-finite input.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDecodeError extends Schema.TaggedError<StatisticsDecodeError>()("StatisticsDecodeError", {
  /** Public estimator whose sample input failed decoding. */
  operation: Schema.String,
  /** Effect Schema issue report for the rejected input. */
  message: Schema.String
}) {}

/**
 * Reports too few observations or unequal sample lengths.
 *
 * @remarks
 * `operation` identifies the estimator. `expected` and `actual` describe the
 * rejected sample shape. Validated and policy-aware variance, covariance, and
 * summary operations emit this error before calculation.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsShapeError extends Schema.TaggedError<StatisticsShapeError>()("StatisticsShapeError", {
  /** Estimator that received too few or incompatible observations. */
  operation: Schema.String,
  /** Required sample count or relationship. */
  expected: Schema.String,
  /** Sample count or relationship found in the rejected input. */
  actual: Schema.String,
  /** Diagnostic combining the estimator and sample-shape details. */
  message: Schema.String
}) {}

/**
 * Reports a non-finite estimator result rejected by strict precision.
 *
 * @remarks
 * `operation` identifies the policy-aware estimator. `message` records the
 * rejected result. Relaxed precision does not emit this error.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDomainViolationError
  extends Schema.TaggedError<StatisticsDomainViolationError>()("StatisticsDomainViolationError", {
    /** Strict-policy estimator that produced a non-finite result. */
    operation: Schema.String,
    /** Diagnostic containing the rejected result or finite-result requirement. */
    message: Schema.String
  })
{}

/**
 * Groups failures that can occur while decoding or encoding a Statistics descriptor.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsBoundaryError = StatisticsDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Groups typed failures declared for Statistics estimators.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsOperationError =
  | StatisticsDecodeError
  | StatisticsShapeError
  | StatisticsDomainViolationError
