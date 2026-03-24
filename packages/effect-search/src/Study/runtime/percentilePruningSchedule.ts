/**
 * Step schedule generation for percentile pruning checkpoints.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match } from "effect"

import type { PercentilePrunerSettings } from "./percentilePruningModel.js"

const intervalOrOne = (intervalSteps: number): number =>
  Match.value(intervalSteps > 0).pipe(
    Match.when(true, () => Math.floor(intervalSteps)),
    Match.orElse(() => 1)
  )

const nearestLowerPruningStep = (step: number, warmupSteps: number, intervalSteps: number): number => {
  const interval = intervalOrOne(intervalSteps)

  return Math.floor((step - warmupSteps) / interval) * interval + warmupSteps
}

const isFirstInIntervalStep = (
  step: number,
  intermediateSteps: ReadonlyArray<number>,
  warmupSteps: number,
  intervalSteps: number
): boolean => {
  const nearestLower = nearestLowerPruningStep(step, warmupSteps, intervalSteps)
  const previousStep = Arr.reduce(
    intermediateSteps,
    -1,
    (current, candidate) => (candidate !== step && candidate > current ? candidate : current)
  )

  return previousStep < nearestLower
}

/**
 * Reports whether enough completed trials and warmup steps have passed to evaluate a percentile pruning threshold.
 *
 * @since 0.1.0
 * @category guards
 */
export const canEvaluatePruningThreshold = (
  settings: PercentilePrunerSettings,
  step: number,
  completedTrialCount: number,
  currentSteps: ReadonlyArray<number>
): boolean =>
  Arr.every(
    Arr.make(
      completedTrialCount > 0,
      completedTrialCount >= settings.startupTrials,
      step >= settings.warmupSteps,
      isFirstInIntervalStep(step, currentSteps, settings.warmupSteps, settings.intervalSteps)
    ),
    (value) => value
  )
