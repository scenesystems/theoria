/**
 * Metric models.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
import type { MetricFn } from "../contracts/MetricFn.js"
import { MetricResult } from "../contracts/MetricResult.js"

/**
 * Schema and constructor for a numeric score with optional feedback.
 *
 * @remarks
 * Scores are not normalized or range-checked. Weighting, when needed, belongs
 * in the scoring function; {@link import("./compose.js").compose} gives every
 * child score equal weight.
 *
 * @since 0.1.0
 * @category models
 */
export const Result = MetricResult

/**
 * Named scoring function from prediction and expected payloads to a
 * {@link MetricResult} Effect.
 *
 * @since 0.1.0
 * @category models
 * @see {@link MetricResult}
 * @see {@link fromEffect}
 * @see {@link import("./compose.js").compose}
 */
export class Metric<E = never, R = never> extends Data.TaggedClass("Metric")<{
  /** Descriptive metric name. Evaluation report keys come from the containing metrics record instead. */
  readonly name: string
  /** Scoring function whose failure `E` and requirements `R` remain in callers' Effect types. */
  readonly score: MetricFn<E, R>
}> {}
