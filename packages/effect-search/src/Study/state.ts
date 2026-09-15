/**
 * Immutable study state backed by a SortedMap for deterministic trial-number-ordered iteration.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Option, SortedMap } from "effect"

import * as Trial from "../Trial/index.js"
import { isCompletedTrialWithConfig } from "./best.js"

/**
 * Immutable record tracking all trial data via a single SortedMap keyed by trial number,
 * guaranteeing deterministic iteration order regardless of insertion or finalization timing.
 *
 * @since 0.1.0
 * @category models
 */
export type StudyState<Config = unknown> = History.History<Config, Trial.TrialState>

/**
 * Builds a study state by replaying an array of pre-existing trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const stateFromInitialTrials = <Config>(
  initialTrials: Iterable<Trial.Trial<Config>>
): StudyState<Config> => History.fromIterable(initialTrials)

/**
 * Returns a new study state with a running trial added.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withReservedTrial = <Config>(
  state: StudyState<Config>,
  trial: Trial.Trial<Config>
): StudyState<Config> => History.setTrial(state, trial)

/**
 * Returns a new study state with a trial moved from pending to finalized, recording its cost once.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withFinalizedTrial = <Config>(
  state: StudyState<Config>,
  trial: Trial.Trial<Config>
): StudyState<Config> => History.setTrial(state, trial)

/**
 * All trials in deterministic trial-number order.
 *
 * @since 0.1.0
 * @category utils
 */
export const trialsFromState = <Config>(state: StudyState<Config>) => History.trials(state)

/**
 * All completed trials in deterministic trial-number order.
 *
 * @since 0.1.0
 * @category utils
 */
export const completedTrialsFromState = <Config>(
  state: StudyState<Config>
) =>
  Arr.filter(
    trialsFromState(state),
    (trial): trial is Trial.CompletedTrial<Config> => isCompletedTrialWithConfig(trial)
  )

/**
 * All currently running (pending) trials in deterministic trial-number order.
 *
 * @since 0.1.0
 * @category utils
 */
export const pendingTrialsFromState = <Config>(
  state: StudyState<Config>
) =>
  Arr.filter(
    trialsFromState(state),
    (trial) => Trial.isState("Running")(trial.state)
  )

/**
 * Looks up a pending trial by trial number, returning None if not found or not in Running state.
 *
 * @since 0.1.0
 * @category utils
 */
export const pendingTrialByNumber = <Config>(
  state: StudyState<Config>,
  trialNumber: number
): Option.Option<Trial.Trial<Config>> =>
  SortedMap.get(state.trials, trialNumber).pipe(
    Option.filter((trial) => Trial.isState("Running")(trial.state))
  )

/**
 * Returns the highest trial number seen so far, or -1 if the state has no trials.
 *
 * @since 0.1.0
 * @category utils
 */
export const maxTrialNumberFromState = <Config>(state: StudyState<Config>): number =>
  Option.match(SortedMap.lastOption(state.trials), {
    onNone: () => -1,
    onSome: ([trialNumber]) => trialNumber
  })

/**
 * Returns the total number of trials tracked in the state.
 *
 * @since 0.1.0
 * @category utils
 */
export const trialCountFromState = <Config>(state: StudyState<Config>): number => SortedMap.size(state.trials)
