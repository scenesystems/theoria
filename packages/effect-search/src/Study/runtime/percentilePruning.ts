/**
 * Percentile-based pruning algorithm that prunes underperforming trials at intermediate steps.
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
  /** @since 0.1.0 */
  PercentilePrunerContextSchema,
  /** @since 0.1.0 */
  PercentilePrunerHistoryTrialSchema,
  /** @since 0.1.0 */
  PercentilePrunerReportSchema,
  /** @since 0.1.0 */
  PercentilePrunerSettingsSchema,
  /** @since 0.1.0 */
  PercentilePrunerTrialStateSchema
}
export type {
  /** @since 0.1.0 */
  PercentilePrunerContext,
  /** @since 0.1.0 */
  PercentilePrunerHistoryTrial,
  /** @since 0.1.0 */
  PercentilePrunerReport,
  /** @since 0.1.0 */
  PercentilePrunerSettings,
  /** @since 0.1.0 */
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
 * Determine whether a trial should be pruned by percentile ranking.
 *
 * @since 0.1.0
 * @category utils
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
