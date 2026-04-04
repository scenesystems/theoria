/**
 * Metric composition combinator.
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
 * Compose multiple named metrics into a single averaged metric. Scores are
 * computed deterministically in alphabetical order. Feedback strings from
 * individual metrics are concatenated.
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
 * Project per-metric scores from a composed metric run into a name→score
 * record.
 *
 * @since 0.1.0
 * @category helpers
 */
export const composedScoreMap = scoreMap
