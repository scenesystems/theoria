/**
 * Single metric evaluation result carrying a numeric score and optional
 * natural-language feedback.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Result of scoring one prediction against its expected output. `score`
 * is a numeric value (typically 0–1 but unbounded for custom metrics).
 * `feedback`, when present, provides human-readable rationale consumed
 * by GEPA's reflective mutation loop to generate improved instructions.
 *
 * @see {@link MetricFn} — effectful scorer that produces MetricResult
 * @see {@link PureMetricFn} — synchronous scorer variant
 *
 * @since 0.0.0
 * @category models
 */
export class MetricResult extends Schema.Class<MetricResult>("MetricResult")({
  score: Schema.Number,
  feedback: Schema.optional(Schema.String)
}) {}
