/**
 * Named scoring operations and their result constructor.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
import type { MetricFn } from "../contracts/MetricFn.js"
import { MetricResult } from "../contracts/MetricResult.js"

/**
 * Constructs a numeric score with optional evaluator feedback.
 *
 * @remarks
 * Scores are not normalized or range-checked. Weighting, when needed, belongs
 * in the scoring function; {@link compose} gives every child score equal weight.
 *
 * @since 0.1.0
 * @category models
 */
export const Result = MetricResult

/**
 * Associates a diagnostic name with an effectful scoring operation.
 *
 * @remarks
 * The scorer receives untyped record payloads because signatures differ across
 * modules. Its typed failures and requirements flow through evaluation and
 * optimization unchanged.
 *
 * @typeParam E - Expected scoring failure.
 * @typeParam R - Services required while scoring.
 *
 * @since 0.1.0
 * @category models
 */
export class Metric<E = never, R = never> extends Data.TaggedClass("Metric")<{
  /** Diagnostic name; evaluation report keys come from the containing metric record. */
  readonly name: string
  /** Scorer whose expected failure and requirements remain in callers' Effect types. */
  readonly score: MetricFn<E, R>
}> {}
