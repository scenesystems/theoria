/**
 * Metric constructors.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { MetricFn, PureMetricFn } from "../contracts/MetricFn.js"
import { Metric } from "./model.js"

/**
 * Create a metric from a synchronous scoring function. Wraps the result in
 * `Effect.succeed` internally.
 *
 * @example
 * ```ts
 * import { Metric } from "effect-dsp"
 *
 * const accuracy = Metric.make("accuracy", (prediction, expected) =>
 *   new Metric.Result({
 *     score: prediction["answer"] === expected["answer"] ? 1 : 0
 *   })
 * )
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = (name: string, score: PureMetricFn): Metric =>
  new Metric({
    name,
    score: (prediction, expected) =>
      Effect.succeed(
        score(prediction, expected)
      )
  })

/**
 * Create a metric from an effectful scoring function — use when scoring
 * requires LLM calls, network access, or other side effects.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromEffect = <E, R>(name: string, score: MetricFn<E, R>): Metric<E, R> =>
  new Metric({
    name,
    score
  })
