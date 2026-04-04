/**
 * Metric and evaluation-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Raised when a metric scoring function fails during evaluation. Carries the
 * metric name for targeted error handling.
 *
 * @since 0.1.0
 * @category errors
 */
export class MetricError extends Schema.TaggedError<MetricError>()(
  "MetricError",
  {
    message: Schema.String,
    metricName: Schema.String
  }
) {}

/**
 * Raised when a single example evaluation fails. Caught and collected by the
 * evaluation runtime — does not abort the full run.
 *
 * @since 0.1.0
 * @category errors
 */
export class EvaluationFailed extends Schema.TaggedError<EvaluationFailed>()(
  "EvaluationFailed",
  {
    message: Schema.String,
    index: Schema.Number
  }
) {}
