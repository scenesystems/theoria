/**
 * Evaluation outcome aggregation.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Option, Record } from "effect"
import { averageNumbers } from "../../Metric/score.js"
import { type ExampleFailure, Report } from "../report.js"
import type { ExampleOutcome } from "./example.js"
import type { MetricEntry } from "./scoring.js"

const outcomeScore = (metricName: string, outcome: ExampleOutcome): Option.Option<number> =>
  outcome.success
    ? Option.fromNullable(outcome.result.scores[metricName])
    : Option.none<number>()

const overallScores = (
  metricEntries: ReadonlyArray<MetricEntry<unknown, unknown>>,
  outcomes: ReadonlyArray<ExampleOutcome>
): Readonly<Record<string, number>> =>
  Arr.reduce(metricEntries, Record.empty<string, number>(), (scores, [metricName]) => {
    const values = Arr.filterMap(outcomes, (outcome) => outcomeScore(metricName, outcome))

    return Record.set(scores, metricName, averageNumbers(values))
  })

const outcomeFailure = (outcome: ExampleOutcome): Option.Option<ExampleFailure> => outcome.failure

/**
 * @since 0.1.0
 * @internal
 */
export type AggregateResult = Readonly<{
  readonly report: Report
  readonly averageScore: number
}>

/**
 * @since 0.1.0
 * @internal
 */
export const aggregateOutcomes = (options: {
  readonly metricEntries: ReadonlyArray<MetricEntry<unknown, unknown>>
  readonly outcomes: ReadonlyArray<ExampleOutcome>
  readonly total: number
}): AggregateResult => {
  const results = Arr.map(options.outcomes, (outcome) => outcome.result)
  const failures = Arr.filterMap(options.outcomes, outcomeFailure)
  const successCount = Arr.reduce(options.outcomes, 0, (count, outcome) => count + (outcome.success ? 1 : 0))
  const failureCount = options.total - successCount
  const averageScore = averageNumbers(
    Arr.filterMap(options.outcomes, (outcome) =>
      outcome.success
        ? Option.some(outcome.averageScore)
        : Option.none<number>())
  )

  return {
    report: new Report({
      overallScores: overallScores(options.metricEntries, options.outcomes),
      results,
      failures,
      totalExamples: options.total,
      successCount,
      failureCount
    }),
    averageScore
  }
}
