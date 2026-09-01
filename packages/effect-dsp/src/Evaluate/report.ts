/**
 * Evaluation report contracts.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Serializable failure captured for one example.
 *
 * @since 0.1.0
 * @category models
 */
export class ExampleFailure extends Schema.Class<ExampleFailure>("ExampleFailure")({
  /** Zero-based input example index. */
  index: Schema.Number,
  /** Effect failure tag, or `UnknownEvaluationError`. */
  tag: Schema.String,
  /** Failure message safe for the report. */
  message: Schema.String
}) {}

/**
 * Result for one input example.
 *
 * @since 0.1.0
 * @category models
 */
export class ExampleResult extends Schema.Class<ExampleResult>("ExampleResult")({
  /** Zero-based input example index. */
  index: Schema.Number,
  /** Scores keyed by the names supplied in `EvaluateOptions.metrics`; empty on failure. */
  scores: Schema.Record({ key: Schema.String, value: Schema.Number }),
  /** Captured example failure, if any. */
  failure: Schema.OptionFromSelf(ExampleFailure),
  /** Elapsed wall-clock milliseconds for this example. */
  durationMs: Schema.Number
}) {}

/**
 * Aggregate report for one evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class Report extends Schema.Class<Report>("EvaluationReport")({
  /** Per-metric arithmetic means over successful examples; `0` when none succeed. */
  overallScores: Schema.Record({ key: Schema.String, value: Schema.Number }),
  /** Results in input-example order. */
  results: Schema.Array(ExampleResult),
  /** Failures in input-example order. */
  failures: Schema.Array(ExampleFailure),
  /** Number of supplied examples. */
  totalExamples: Schema.Number,
  /** Examples scored by every metric. */
  successCount: Schema.Number,
  /** Examples that failed decoding, execution, or scoring. */
  failureCount: Schema.Number
}) {}
