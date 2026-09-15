/**
 * Evaluation outcome aggregation.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Boolean, Data, Number, Option, Record } from "effect"
import { averageNumbers } from "../../Metric/score.js"
import { type ExampleFailure, Report } from "../report.js"
import type { ExampleOutcome, MetricEntry } from "./example.js"

const outcomeScore = (metricName: string, outcome: ExampleOutcome): Option.Option<number> =>
  Boolean.match(outcome.success, {
    onTrue: () => Option.fromNullable(outcome.result.scores[metricName]),
    onFalse: () => Option.none<number>()
  })

const overallScores = <ME, MR>(
  metricEntries: Iterable<MetricEntry<ME, MR>>,
  outcomes: Iterable<ExampleOutcome>
): Record.ReadonlyRecord<string, number> =>
  Arr.reduce(metricEntries, Record.empty<string, number>(), (scores, [metricName]) => {
    const values = Arr.filterMap(outcomes, (outcome) => outcomeScore(metricName, outcome))

    return Record.set(scores, metricName, averageNumbers(values))
  })

const outcomeFailure = (outcome: ExampleOutcome): Option.Option<ExampleFailure> => outcome.failure

/**
 * @since 0.1.0
 * @internal
 */
export class AggregateResult extends Data.Class<{
  readonly report: Report
  readonly averageScore: number
}> {}

export class AggregateOptions<ME, MR> extends Data.Class<{
  readonly metricEntries: Iterable<MetricEntry<ME, MR>>
  readonly outcomes: Iterable<ExampleOutcome>
  readonly total: number
}> {}

/**
 * @since 0.1.0
 * @internal
 */
export const aggregateOutcomes = <ME, MR>(options: AggregateOptions<ME, MR>): AggregateResult => {
  const metricEntries = Arr.fromIterable(options.metricEntries)
  const outcomes = Arr.fromIterable(options.outcomes)
  const results = Arr.map(outcomes, (outcome) => outcome.result)
  const failures = Arr.filterMap(outcomes, outcomeFailure)
  const successCount = Arr.reduce(
    outcomes,
    0,
    (count, outcome) =>
      Number.sum(
        count,
        Boolean.match(outcome.success, { onTrue: () => 1, onFalse: () => 0 })
      )
  )
  const failureCount = Number.subtract(options.total, successCount)
  const averageScore = averageNumbers(
    Arr.filterMap(outcomes, (outcome) =>
      Boolean.match(outcome.success, {
        onTrue: () => Option.some(outcome.averageScore),
        onFalse: () => Option.none<number>()
      }))
  )

  return new AggregateResult({
    report: new Report({
      overallScores: overallScores(metricEntries, outcomes),
      results,
      failures,
      totalExamples: options.total,
      successCount,
      failureCount
    }),
    averageScore
  })
}
