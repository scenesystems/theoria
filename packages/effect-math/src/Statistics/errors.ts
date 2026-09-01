/**
 * Typed error taxonomy for the Statistics domain. Each error is a
 * `Schema.TaggedError` so it round-trips through Effect channels and
 * can be pattern-matched by `_tag`. Errors are stratified into boundary
 * failures (decode) and operation failures (shape, domain violation).
 *
 * @since 0.1.0
 * @category errors
 */
import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"

/**
 * Reports failure to validate the Statistics descriptor before estimator orchestration.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDomainBoundaryError
  extends Schema.TaggedError<StatisticsDomainBoundaryError>()("StatisticsDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Reports rejected boundary input for a sample estimator.
 *
 * @remarks
 * `operation` identifies the attempted estimator and `message` preserves the
 * rendered Schema issue for diagnostics.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDecodeError extends Schema.TaggedError<StatisticsDecodeError>()("StatisticsDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised by validated and policy-aware sample estimators for unequal sample
 * lengths or fewer than two observations where Bessel correction is used.
 * `expected` and `actual` are diagnostic shape descriptions.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsShapeError extends Schema.TaggedError<StatisticsShapeError>()("StatisticsShapeError", {
  operation: Schema.String,
  expected: Schema.String,
  actual: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised under the `"strict"` precision policy when an operation produces a
 * non-finite result (NaN or ±Infinity). Relaxed policy-aware operations pass
 * the computed IEEE 754 value through.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDomainViolationError
  extends Schema.TaggedError<StatisticsDomainViolationError>()("StatisticsDomainViolationError", {
    operation: Schema.String,
    message: Schema.String
  })
{}

/**
 * Descriptor-level failures to recover before estimator discovery or
 * registration, separate from sample validation and calculation.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsBoundaryError = StatisticsDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Estimator failures distinguishing malformed samples, insufficient or
 * incompatible sample shapes, and strict-policy rejection of non-finite output.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsOperationError =
  | StatisticsDecodeError
  | StatisticsShapeError
  | StatisticsDomainViolationError
