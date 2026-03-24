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
 * Raised when an orchestration-level boundary validation fails before
 * reaching the specific operation. Use this as a catch-all for validation
 * pipelines that span multiple operations within the domain.
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
 * Raised when Schema decode fails for a specific operation's input contract
 * (e.g. `SampleInput`, `TwoSampleInput`). The `operation` field names the
 * failed operation so callers can branch on it in error-recovery logic.
 *
 * @since 0.1.0
 * @category errors
 */
export class StatisticsDecodeError extends Schema.TaggedError<StatisticsDecodeError>()("StatisticsDecodeError", {
  operation: Schema.String,
  message: Schema.String
}) {}

/**
 * Raised when operand shape is incompatible — for example, an empty sample
 * or insufficient data for the requested estimator. The `expected` and
 * `actual` fields carry human-readable descriptions for diagnostic messages.
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
 * non-finite result (NaN or ±Infinity) due to numerical issues such as
 * negative variance from catastrophic cancellation.
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
 * Union of all boundary-level errors that can arise from domain validation,
 * Schema decode, or Schema encode at the package edge.
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsBoundaryError = StatisticsDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError

/**
 * Union of all errors that can arise from within a statistics operation
 * (after boundary decode succeeds).
 *
 * @since 0.1.0
 * @category errors
 */
export type StatisticsOperationError =
  | StatisticsDecodeError
  | StatisticsShapeError
  | StatisticsDomainViolationError
