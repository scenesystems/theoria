/**
 * Context carried into contextual metric scoring.
 *
 * @since 0.2.0
 */
import type { Effect } from "effect"

import type { MetricPayload } from "../contracts/MetricFn.js"
import type { MetricResult } from "../contracts/MetricResult.js"

/**
 * Full metric-scoring context preserved by `Evaluate` and optimizer loops.
 *
 * @since 0.2.0
 * @category models
 */
export type MetricContext = Readonly<{
  readonly input: MetricPayload
  readonly prediction: MetricPayload
  readonly expected: MetricPayload
  readonly metadata: MetricPayload
}>

/**
 * Effectful scorer over the full metric context.
 *
 * @since 0.2.0
 * @category models
 */
export type MetricContextFn<E = never, R = never> = (
  context: MetricContext
) => Effect.Effect<MetricResult, E, R>

/**
 * Synchronous scorer over the full metric context.
 *
 * @since 0.2.0
 * @category models
 */
export type PureMetricContextFn = (context: MetricContext) => MetricResult

const emptyPayload: MetricPayload = {}

const of = (options: {
  readonly prediction: MetricPayload
  readonly expected: MetricPayload
  readonly input?: MetricPayload
  readonly metadata?: MetricPayload
}): MetricContext => ({
  input: options.input ?? emptyPayload,
  prediction: options.prediction,
  expected: options.expected,
  metadata: options.metadata ?? emptyPayload
})

/**
 * Construct one canonical metric context with stable empty defaults.
 *
 * @since 0.2.0
 * @category constructors
 */
export const MetricContext = { of }
