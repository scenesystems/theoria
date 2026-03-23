/**
 * History value extraction and best-value tracking for percentile pruning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import type { PercentilePrunerHistoryTrial, PercentilePrunerReport } from "./percentilePruningModel.js"

const reportValueAtStep = (reports: ReadonlyArray<PercentilePrunerReport>, step: number): Option.Option<number> =>
  Arr.findFirst(reports, (report) => report.step === step).pipe(
    Option.map((report) => report.value)
  )

/**
 * Collects reported values at a given step from all completed history trials for percentile comparison.
 *
 * @since 0.1.0
 * @category utils
 */
export const historyValuesAtStep = (
  history: ReadonlyArray<PercentilePrunerHistoryTrial>,
  step: number
): Array<number> =>
  Arr.filterMap(
    history,
    (trial) =>
      Match.value(trial.state).pipe(
        Match.when("complete", () => reportValueAtStep(trial.reports, step)),
        Match.orElse(() => Option.none())
      )
  )

/**
 * Returns the best intermediate report value across all steps for a given direction, or NaN if no valid values exist.
 *
 * @since 0.1.0
 * @category utils
 */
export const bestIntermediateValue = (reports: ReadonlyArray<PercentilePrunerReport>, direction: Direction): number => {
  const values = Arr.map(reports, (report) => report.value)
  const nonNaN = Arr.filter(values, (value) => !Number.isNaN(value))

  return Match.value(nonNaN.length === 0).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() =>
      Match.value(direction).pipe(
        Match.when("maximize", () => Arr.reduce(nonNaN, Number.NEGATIVE_INFINITY, Num.max)),
        Match.orElse(() => Arr.reduce(nonNaN, Number.POSITIVE_INFINITY, Num.min))
      )
    )
  )
}
