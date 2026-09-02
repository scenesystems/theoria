/**
 * Deterministic aggregation of several named metrics.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Option, Order, Record } from "effect"
import type { MetricPayload } from "../contracts/MetricFn.js"
import type { MetricResult } from "../contracts/MetricResult.js"
import { fromEffect } from "./constructors.js"
import { type Metric, Result } from "./model.js"
import { averageNumbers } from "./score.js"

type MetricEntry<E, R> = [string, Metric<E, R>]

const sortMetricEntries = <E, R>(
  entries: ReadonlyArray<MetricEntry<E, R>>
): ReadonlyArray<MetricEntry<E, R>> => {
  const metricNameOrder: Order.Order<MetricEntry<E, R>> = Order.mapInput(Order.string, (entry) => entry[0])

  return Arr.sort(entries, metricNameOrder)
}

const sortedEntries = <E, R>(metrics: Readonly<Record<string, Metric<E, R>>>): ReadonlyArray<MetricEntry<E, R>> =>
  sortMetricEntries(Record.toEntries(metrics))

const optionalFeedback = (feedback: Option.Option<string>): Readonly<Record<string, string>> =>
  Option.match(feedback, {
    onNone: () => ({}),
    onSome: (value) => ({ feedback: value })
  })

const combineFeedback = (scores: ReadonlyArray<readonly [string, MetricResult]>): Option.Option<string> => {
  const lines = Arr.filterMap(
    scores,
    ([metricName, result]) =>
      Option.map(Option.fromNullable(result.feedback), (feedback) => `[${metricName}] ${feedback}`)
  )

  return Option.match(Arr.head(lines), {
    onNone: () => Option.none<string>(),
    onSome: () => Option.some(Arr.join(lines, "\n"))
  })
}

const scoreList = (scores: ReadonlyArray<readonly [string, MetricResult]>): ReadonlyArray<number> =>
  Arr.map(scores, ([, result]) => result.score)

const scoreMap = (scores: ReadonlyArray<readonly [string, MetricResult]>): Readonly<Record<string, number>> =>
  Arr.reduce(
    scores,
    Record.empty<string, number>(),
    (current, [name, result]) => Record.set(current, name, result.score)
  )

/**
 * Combines named metrics with an equal-weight arithmetic mean.
 *
 * @remarks
 * Child metrics execute sequentially in name-sorted order. Their failures and
 * requirements are preserved. Present feedback is joined in that same order
 * as `[name] feedback` lines. An empty metric record scores `0`.
 *
 * @param metrics - Child metrics keyed by the names used to order and label feedback.
 * @returns A metric whose requirement and error channels match its children.
 * @typeParam E - Expected failure shared by the child metrics.
 * @typeParam R - Services required by the child metrics.
 *
 * @since 0.1.0
 * @category combinators
 */
export const compose = <E = never, R = never>(
  metrics: Readonly<Record<string, Metric<E, R>>>
): Metric<E, R> =>
  fromEffect<E, R>("compose", (prediction: MetricPayload, expected: MetricPayload) =>
    Effect.gen(function*() {
      const entries = sortedEntries(metrics)
      const scores = yield* Effect.forEach(entries, ([metricName, metric]) =>
        metric.score(prediction, expected).pipe(
          Effect.map((result) => Data.tuple(metricName, result))
        ))

      const feedback = combineFeedback(scores)
      const meanScore = averageNumbers(scoreList(scores))

      return new Result({
        score: meanScore,
        ...optionalFeedback(feedback)
      })
    }))

/**
 * Projects named metric results to their numeric scores.
 *
 * @remarks
 * Later tuples replace earlier scores with the same name.
 *
 * @param scores - Name and result tuples in caller-defined order.
 * @returns A record containing the final score for each name.
 *
 * @since 0.1.0
 * @category combinators
 */
export const composedScoreMap = scoreMap
