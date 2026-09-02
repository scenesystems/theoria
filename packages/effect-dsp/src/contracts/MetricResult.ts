/**
 * Serializable result produced by one metric invocation.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Carries a score and optional evaluator feedback.
 *
 * @remarks
 * The schema accepts every JavaScript number, including non-finite values. Each
 * metric owns any range or finiteness requirement; this contract applies none.
 *
 * @since 0.1.0
 * @category models
 */
export class MetricResult extends Schema.Class<MetricResult>("MetricResult")({
  /** Metric-defined numeric result with no shared range constraint. */
  score: Schema.Number,
  /** Evaluator explanation intended for diagnostics or optimizer feedback. */
  feedback: Schema.optional(Schema.String)
}) {}
