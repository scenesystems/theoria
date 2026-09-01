/**
 * Metric and evaluation-domain errors.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Identifies a failure produced by a named metric. Metric effects may fail
 * with their own error type; `MetricError` is the package-level diagnostic
 * used when that failure must be represented independently of the metric's
 * generic error channel.
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
 * Records an example that could not be evaluated. The zero-based `index`
 * refers to the input dataset, so callers can correlate a failure after
 * concurrent evaluation has reordered completion. Evaluation reports collect
 * these values rather than failing the entire run.
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
