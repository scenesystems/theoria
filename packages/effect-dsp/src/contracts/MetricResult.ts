/**
 * Single metric evaluation result carrying a numeric score and optional
 * natural-language feedback.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Result of scoring one prediction against its expected output. The schema
 * accepts any JavaScript number; metric-specific ranges are enforced by the
 * metric, not by this contract. `feedback` is optional scorer-provided text.
 *
 * @since 0.1.0
 * @category models
 */
export class MetricResult extends Schema.Class<MetricResult>("MetricResult")({
  score: Schema.Number,
  feedback: Schema.optional(Schema.String)
}) {}
