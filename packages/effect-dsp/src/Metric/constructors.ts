/**
 * Metric constructors.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { MetricFn, PureMetricFn } from "../contracts/MetricFn.js"
import { Metric } from "./model.js"

/**
 * Creates a metric whose synchronous scorer cannot fail or require services.
 *
 * @example
 * ```ts
 * import { Metric } from "@scenesystems/effect-dsp"
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
 * Creates a metric while preserving the scorer's failure and requirement
 * types.
 *
 * @example
 * ```ts
 * import * as Metric from "@scenesystems/effect-dsp/Metric"
 * import { Effect } from "effect"
 *
 * const graded = Metric.fromEffect("graded", (prediction, expected) =>
 *   Effect.succeed(new Metric.Result({
 *     score: prediction["answer"] === expected["answer"] ? 1 : 0,
 *     feedback: "Compared answer fields"
 *   }))
 * )
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromEffect = <E, R>(name: string, score: MetricFn<E, R>): Metric<E, R> =>
  new Metric({
    name,
    score
  })
