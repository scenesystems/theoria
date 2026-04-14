/**
 * Metric constructors.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { MetricFn, PureMetricFn } from "../contracts/MetricFn.js"
import { MetricContext, type MetricContextFn, type PureMetricContextFn } from "./context.js"
import { Metric } from "./model.js"

const contextualFromLegacy = <E, R>(score: MetricFn<E, R>): MetricContextFn<E, R> => ({ prediction, expected }) =>
  score(prediction, expected)

const legacyFromContextual = <E, R>(score: MetricContextFn<E, R>): MetricFn<E, R> => (prediction, expected) =>
  score(MetricContext.of({ prediction, expected }))

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
      ),
    scoreContext: contextualFromLegacy((prediction, expected) =>
      Effect.succeed(
        score(prediction, expected)
      )
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
    score,
    scoreContext: contextualFromLegacy(score)
  })

/**
 * Create a contextual metric from a synchronous scoring function.
 *
 * @since 0.2.0
 * @category constructors
 */
export const makeContextual = (name: string, score: PureMetricContextFn): Metric =>
  new Metric({
    name,
    score: legacyFromContextual((context) => Effect.succeed(score(context))),
    scoreContext: (context) => Effect.succeed(score(context))
  })

/**
 * Create a contextual metric from an effectful scoring function.
 *
 * @since 0.2.0
 * @category constructors
 */
export const fromEffectContextual = <E, R>(name: string, score: MetricContextFn<E, R>): Metric<E, R> =>
  new Metric({
    name,
    score: legacyFromContextual(score),
    scoreContext: score
  })
