/**
 * Metric models.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
import type { MetricFn } from "../contracts/MetricFn.js"
import { MetricResult } from "../contracts/MetricResult.js"
import type { MetricContextFn } from "./context.js"

/**
 * Re-export of `MetricResult` — a score with optional feedback text.
 *
 * @since 0.1.0
 * @category models
 */
export const Result = MetricResult

/**
 * A named scoring function that compares a prediction to an expected output
 * and returns a `MetricResult`. Metrics can be pure or effectful, and compose
 * via `Metric.compose`.
 *
 * @since 0.1.0
 * @category models
 * @see {@link MetricFn}
 * @see {@link MetricResult}
 * @see {@link import("./compose.js").compose}
 */
export class Metric<E = never, R = never> extends Data.TaggedClass("Metric")<{
  readonly name: string
  readonly score: MetricFn<E, R>
  readonly scoreContext: MetricContextFn<E, R>
}> {}
