/**
 * Best-trial selection logic for single-objective and multi-objective optimizations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option } from "effect"

import type { Direction } from "../../Direction.js"
import * as Trial from "../../Trial.js"

/**
 * Reports whether a trial has reached the Completed lifecycle state (value-erased variant).
 *
 * @since 0.1.0
 * @category guards
 */
export const isCompletedTrial = (
  trial: Trial.Trial<unknown>
): trial is Trial.CompletedTrial<unknown> => Trial.isState("Completed")(trial.state)

/**
 * Reports whether a trial completed with a single numeric objective value (value-erased variant).
 *
 * @since 0.1.0
 * @category guards
 */
export const isNumericCompletedTrial = (
  trial: Trial.Trial<unknown>
): trial is Trial.NumericCompletedTrial<unknown> =>
  Option.liftPredicate(trial, isCompletedTrial).pipe(Option.exists(Trial.isNumericCompleted))

/**
 * Reports whether a trial has reached the Completed lifecycle state, preserving the Config type parameter.
 *
 * @since 0.1.0
 * @category guards
 */
export const isCompletedTrialWithConfig = <Config>(
  trial: Trial.Trial<Config>
): trial is Trial.CompletedTrial<Config> => Trial.isState("Completed")(trial.state)

/**
 * Reports whether a trial completed with a single numeric objective value, preserving the Config type parameter.
 *
 * @since 0.1.0
 * @category guards
 */
export const isNumericCompletedTrialWithConfig = <Config>(
  trial: Trial.Trial<Config>
): trial is Trial.NumericCompletedTrial<Config> =>
  Option.liftPredicate(trial, isCompletedTrialWithConfig).pipe(Option.exists(Trial.isNumericCompleted))

/**
 * Reports whether `current` is strictly better than `best` according to the optimization direction.
 *
 * @since 0.1.0
 * @category utils
 */
export const betterByDirection = (direction: Direction, current: number, best: number): boolean =>
  Match.value(direction).pipe(
    Match.when("minimize", () => Num.lessThan(current, best)),
    Match.when("maximize", () => Num.greaterThan(current, best)),
    Match.exhaustive
  )

/**
 * Selects the single best trial from a list of numeric completed trials according to the optimization direction.
 *
 * @since 0.1.0
 * @category utils
 */
export const pickBestTrial = <Config>(
  direction: Direction,
  trials: Iterable<Trial.NumericCompletedTrial<Config>>
): Option.Option<Trial.NumericCompletedTrial<Config>> =>
  Arr.reduce(
    trials,
    Option.none<Trial.NumericCompletedTrial<Config>>(),
    (currentBest, candidate) =>
      Option.match(currentBest, {
        onNone: () => Option.some(candidate),
        onSome: (best) =>
          Option.some(
            Match.value(betterByDirection(direction, candidate.state.value, best.state.value)).pipe(
              Match.when(true, () => candidate),
              Match.when(false, () => best),
              Match.exhaustive
            )
          )
      })
  )

/**
 * Extracts the best numeric objective value from a list of trials, returning None when no numeric completed trials exist.
 *
 * @since 0.1.0
 * @category utils
 */
export const bestValueFromTrials = <Config>(
  direction: Direction,
  trials: Iterable<Trial.Trial<Config>>
): Option.Option<number> =>
  pickBestTrial(
    direction,
    Arr.filter(
      trials,
      (trial): trial is Trial.NumericCompletedTrial<Config> => isNumericCompletedTrialWithConfig(trial)
    )
  ).pipe(Option.map((trial) => trial.state.value))
