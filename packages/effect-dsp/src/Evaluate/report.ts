/**
 * Evaluation report contracts.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Typed failure projection for a single example — captures the example index,
 * error tag, and human-readable message.
 *
 * @since 0.0.0
 * @category models
 */
export class ExampleFailure extends Schema.Class<ExampleFailure>("ExampleFailure")({
  index: Schema.Number,
  tag: Schema.String,
  message: Schema.String
}) {}

/**
 * Per-example evaluation result containing metric scores, optional failure,
 * and wall-clock duration.
 *
 * @since 0.0.0
 * @category models
 */
export class ExampleResult extends Schema.Class<ExampleResult>("ExampleResult")({
  index: Schema.Number,
  scores: Schema.Record({ key: Schema.String, value: Schema.Number }),
  failure: Schema.OptionFromSelf(ExampleFailure),
  durationMs: Schema.Number
}) {}

/**
 * Aggregate evaluation report — overall scores per metric, per-example
 * results, failure list, and success/failure counts.
 *
 * @since 0.0.0
 * @category models
 */
export class Report extends Schema.Class<Report>("EvaluationReport")({
  overallScores: Schema.Record({ key: Schema.String, value: Schema.Number }),
  results: Schema.Array(ExampleResult),
  failures: Schema.Array(ExampleFailure),
  totalExamples: Schema.Number,
  successCount: Schema.Number,
  failureCount: Schema.Number
}) {}
