/**
 * Immutable study state backed by a SortedMap for deterministic trial-number-ordered iteration.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Number as Num, Option, SortedMap } from "effect"
import type { Order } from "effect"

import * as Trial from "../Trial/index.js"
import { isCompletedTrialWithConfig } from "./best.js"

const TrialNumberOrder: Order.Order<number> = Num.Order

/**
 * Immutable record tracking all trial data via a single SortedMap keyed by trial number,
 * guaranteeing deterministic iteration order regardless of insertion or finalization timing.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyState<Config = unknown> extends Data.Class<{
  readonly trials: SortedMap.SortedMap<number, Trial.Trial<Config>>
  readonly cumulativeCost: number
}> {}

const validCost = (cost: number): boolean => Number.isFinite(cost) && Num.greaterThanOrEqualTo(cost, 0)

const costFromTrial = <Config>(trial: Trial.Trial<Config>): number =>
  Option.fromNullable(trial.cost).pipe(
    Option.filter(validCost),
    Option.getOrElse(() => 0)
  )

/**
 * Constructs a zero-trial study state.
 *
 * @since 0.1.0
 * @category constructors
 */
export const emptyStudyState = <Config>(): StudyState<Config> =>
  new StudyState({
    trials: SortedMap.empty<number, Trial.Trial<Config>>(TrialNumberOrder),
    cumulativeCost: 0
  })

/**
 * Builds a study state by replaying an array of pre-existing trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const stateFromInitialTrials = <Config>(
  initialTrials: ReadonlyArray<Trial.Trial<Config>>
): StudyState<Config> =>
  new StudyState({
    trials: SortedMap.fromIterable(
      Arr.map(initialTrials, (trial): readonly [number, Trial.Trial<Config>] => [trial.trialNumber, trial]),
      TrialNumberOrder
    ),
    cumulativeCost: Arr.reduce(initialTrials, 0, (acc, trial) => Num.sum(acc, costFromTrial(trial)))
  })

/**
 * Returns a new study state with a running trial added.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withReservedTrial = <Config>(
  state: StudyState<Config>,
  trial: Trial.Trial<Config>
): StudyState<Config> =>
  new StudyState({
    trials: SortedMap.set(state.trials, trial.trialNumber, trial),
    cumulativeCost: state.cumulativeCost
  })

/**
 * Returns a new study state with a trial moved from pending to finalized, accumulating its cost.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withFinalizedTrial = <Config>(
  state: StudyState<Config>,
  trial: Trial.Trial<Config>
): StudyState<Config> =>
  new StudyState({
    trials: SortedMap.set(state.trials, trial.trialNumber, trial),
    cumulativeCost: Num.sum(state.cumulativeCost, costFromTrial(trial))
  })

/**
 * All trials in deterministic trial-number order.
 *
 * @since 0.1.0
 * @category utils
 */
export const trialsFromState = <Config>(state: StudyState<Config>): Array<Trial.Trial<Config>> =>
  Arr.fromIterable(SortedMap.values(state.trials))

/**
 * All completed trials in deterministic trial-number order.
 *
 * @since 0.1.0
 * @category utils
 */
export const completedTrialsFromState = <Config>(
  state: StudyState<Config>
): Array<Trial.CompletedTrial<Config>> =>
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
): Array<Trial.Trial<Config>> =>
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
