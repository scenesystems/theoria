/**
 * Deterministic aggregation of several named metrics.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Order, Record, Result as NativeResult, String, Tuple } from "effect"
import { type Metric, Result } from "../../Metric.js"
import { fromEffect } from "./constructors.js"
import { averageNumbers } from "./score.js"

type MetricEntry<E, R, A> = readonly [string, Metric<E, R, A>]
type NamedResult = readonly [string, Result]

const sortedEntries = <E, R, A>(
  metrics: Record.ReadonlyRecord<string, Metric<E, R, A>>
) =>
  Arr.sort(
    Record.toEntries(metrics),
    Order.mapInput(Order.String, (entry: MetricEntry<E, R, A>) => entry[0])
  )

const combineFeedback = (scores: Iterable<NamedResult>): Option.Option<string> => {
  const lines = Arr.filterMap(
    scores,
    (entry) =>
      NativeResult.fromOption(
        Option.map(
          Option.fromNullishOr(entry[1].feedback),
          (feedback) => String.concat(String.concat(String.concat("[", entry[0]), "] "), feedback)
        ),
        () => void 0
      )
  )

  return Option.match(Arr.head(lines), {
    onNone: () => Option.none<string>(),
    onSome: () => Option.some(Arr.join(lines, "\n"))
  })
}

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
 * @typeParam A - Decoded output values accepted by every child metric.
 *
 * @since 0.1.0
 * @category combinators
 */
export const compose = <E = never, R = never, A = unknown>(
  metrics: Record.ReadonlyRecord<string, Metric<E, R, A>>
): Metric<E, R, A> =>
  fromEffect("compose", (prediction: A, expected: A) =>
    Effect.gen(function*() {
      const entries = sortedEntries(metrics)
      const scores = yield* Effect.forEach(entries, (entry) =>
        entry[1].score(prediction, expected).pipe(
          Effect.map((result) => Tuple.make(entry[0], result))
        ))

      const feedback = combineFeedback(scores)
      const meanScore = averageNumbers(Arr.map(scores, (entry) => entry[1].score))

      return new Result({
        score: meanScore,
        ...Option.match(feedback, {
          onNone: () => ({}),
          onSome: (feedback) => ({ feedback })
        })
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
export const composedScoreMap = (scores: Iterable<NamedResult>) =>
  Arr.reduce(
    scores,
    Record.empty<string, number>(),
    (current, entry) => Record.set(current, entry[0], entry[1].score)
  )
