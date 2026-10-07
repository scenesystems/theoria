/** Failure-inclusive evaluation aggregates. @since 0.1.0 @internal */
import { Array as Arr, Option, Record, Tuple } from "effect"
import { type Outcome, Report } from "../../Evaluate.js"
import { averageNumbers } from "../metric/score.js"

/** Every input contributes to each metric denominator. Failed rows contribute
 * the configured failure score; no failure is reclassified as a success.
 * @since 0.7.0
 * @internal
 */
export const aggregateOutcomes = (
  metricNames: ReadonlyArray<string>,
  outcomes: ReadonlyArray<Outcome>,
  failureScore: number
): Report => {
  const failed = Arr.filter(outcomes, (outcome) => outcome._tag === "Failed")
  return new Report({
    outcomes,
    overallScores: Record.fromEntries(Arr.map(metricNames, (name) =>
      Tuple.make(
        name,
        averageNumbers(
          Arr.map(
            outcomes,
            (outcome) =>
              outcome._tag === "Failed" ? failureScore : Option.getOrThrow(Record.get(outcome.scores, name)).value
          )
        )
      ))),
    average: averageNumbers(
      Arr.map(outcomes, (outcome) => outcome._tag === "Failed" ? failureScore : outcome.score.value)
    ),
    units: "fraction",
    failures: Arr.map(failed, (outcome) => outcome.failure),
    totalExamples: Arr.length(outcomes),
    successCount: Arr.length(outcomes) - Arr.length(failed),
    failureCount: Arr.length(failed)
  })
}
