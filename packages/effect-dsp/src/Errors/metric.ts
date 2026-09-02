/**
 * Serializable metric and per-example evaluation failures.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Associates a scoring failure with a metric name.
 *
 * @remarks
 * Metric scorers retain their own generic error types, and built-in evaluation
 * captures those failures as {@link ExampleFailure}. Use `MetricError` when an
 * integration needs a serializable package-level metric diagnostic.
 *
 * @since 0.1.0
 * @category errors
 */
export class MetricError extends Schema.TaggedError<MetricError>()(
  "MetricError",
  {
    /** Diagnostic text supplied by the scoring integration. */
    message: Schema.String,
    /** Name of the metric that failed. */
    metricName: Schema.String
  }
) {}

/**
 * Identifies an example that cannot be decoded, executed, or scored.
 *
 * @remarks
 * The zero-based index refers to input order, even when concurrent evaluation
 * changes completion order. {@link Evaluate.run} captures this error in its
 * report instead of failing the whole evaluation.
 *
 * @since 0.1.0
 * @category errors
 */
export class EvaluationFailed extends Schema.TaggedError<EvaluationFailed>()(
  "EvaluationFailed",
  {
    /** Diagnostic text describing the failed evaluation step. */
    message: Schema.String,
    /** Zero-based position in the input dataset. */
    index: Schema.Number
  }
) {}
