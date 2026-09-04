/**
 * Pure percentile comparison for intermediate trial reports.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match } from "effect"

import { bestIntermediateValue, historyValuesAtStep } from "./percentilePruningHistory.js"
import {
  type PercentilePrunerContext,
  PercentilePrunerContextSchema,
  type PercentilePrunerHistoryTrial,
  PercentilePrunerHistoryTrialSchema,
  type PercentilePrunerReport,
  PercentilePrunerReportSchema,
  type PercentilePrunerSettings,
  PercentilePrunerSettingsSchema,
  type PercentilePrunerTrialState,
  PercentilePrunerTrialStateSchema
} from "./percentilePruningModel.js"
import { percentileForDirection, percentileValue } from "./percentilePruningPercentile.js"
import { canEvaluatePruningThreshold } from "./percentilePruningSchedule.js"

export {
  PercentilePrunerContextSchema,
  PercentilePrunerHistoryTrialSchema,
  PercentilePrunerReportSchema,
  PercentilePrunerSettingsSchema,
  PercentilePrunerTrialStateSchema
}
export type {
  PercentilePrunerContext,
  PercentilePrunerHistoryTrial,
  PercentilePrunerReport,
  PercentilePrunerSettings,
  PercentilePrunerTrialState
}

const completedTrialCount = (history: ReadonlyArray<PercentilePrunerHistoryTrial>): number =>
  Arr.reduce(history, 0, (count, trial) => (trial.state === "complete" ? count + 1 : count))

const shouldPruneFromThreshold = (
  direction: PercentilePrunerContext["direction"],
  best: number,
  threshold: number
): boolean =>
  Match.value(direction).pipe(
    Match.when("maximize", () => best < threshold),
    Match.orElse(() => best > threshold)
  )

/**
 * Compares the current trial's best reported value with completed peers at the
 * requested step. The function returns `false` until at least one completed
 * trial exists and the startup, warmup, interval, and minimum-peer gates pass.
 *
 * @remarks
 * Minimization prunes above the configured percentile. Maximization compares
 * below the complementary percentile. A `NaN` current best prunes immediately;
 * `NaN` peer values are ignored. The function trusts the supplied context and
 * does not run {@link PercentilePrunerContextSchema}.
 *
 * @since 0.1.0
 * @category guards
 */
export const shouldPruneByPercentile = ({
  direction,
  settings,
  step,
  history,
  currentReports
}: PercentilePrunerContext): boolean => {
  const completed = completedTrialCount(history)
  const currentSteps = Arr.map(currentReports, (report) => report.step)

  return Match.value(canEvaluatePruningThreshold(settings, step, completed, currentSteps)).pipe(
    Match.when(false, () => false),
    Match.orElse(() => {
      const best = bestIntermediateValue(currentReports, direction)

      return Match.value(Number.isNaN(best)).pipe(
        Match.when(true, () => true),
        Match.orElse(() => {
          const values = historyValuesAtStep(history, step)

          return Match.value(values.length < settings.nMinTrials).pipe(
            Match.when(true, () => false),
            Match.orElse(() => {
              const threshold = percentileValue(values, percentileForDirection(direction, settings.percentile))

              return Match.value(Number.isNaN(threshold)).pipe(
                Match.when(true, () => false),
                Match.orElse(() => shouldPruneFromThreshold(direction, best, threshold))
              )
            })
          )
        })
      )
    })
  )
}
