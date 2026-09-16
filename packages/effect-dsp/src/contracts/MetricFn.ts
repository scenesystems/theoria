/**
 * Scorer function contracts used by `Evaluate` and optimizer inner loops.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import type { MetricResult } from "./MetricResult.js"

/**
 * Effectful scorer that compares decoded prediction and expected output values.
 * `A` is the output schema's decoded type, not its encoded representation.
 * `E` is the scorer's typed failure and `R` is its required Effect context.
 *
 * @see {@link PureMetricFn} — synchronous variant for simple scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.1.0
 * @category models
 */
export type MetricFn<A, E = never, R = never> = (
  prediction: A,
  expected: A
) => Effect.Effect<MetricResult, E, R>

/**
 * Synchronous scorer with no typed failure or Effect context.
 *
 * @see {@link MetricFn} — effectful variant for LM-as-judge scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.1.0
 * @category models
 */
export type PureMetricFn<A> = (
  prediction: A,
  expected: A
) => MetricResult
