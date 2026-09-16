/** Optimization-specific queries over native effect-study history. */
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Number as Num, Option, SortedMap } from "effect"

import * as Trial from "../../Trial.js"
import { isCompletedTrialWithConfig } from "./best.js"

export const completedTrialsFromState = <Config>(state: History.History<Config, Trial.State>) =>
  Arr.filter(
    History.values(state),
    (trial): trial is Trial.CompletedTrial<Config> => isCompletedTrialWithConfig(trial)
  )

export const pendingTrialsFromState = <Config>(state: History.History<Config, Trial.State>) =>
  Arr.filter(
    History.values(state),
    (trial) => Trial.isState("Running")(trial.state)
  )

export const pendingTrialByNumber = <Config>(
  state: History.History<Config, Trial.State>,
  trialNumber: number
): Option.Option<Trial.Trial<Config>> =>
  SortedMap.get(state.trials, trialNumber).pipe(
    Option.filter((trial) => Trial.isState("Running")(trial.state))
  )

export const maxTrialNumberFromState = <Config>(state: History.History<Config, Trial.State>): number =>
  Option.match(SortedMap.lastOption(state.trials), {
    onNone: () => Num.negate(1),
    onSome: ([trialNumber]) => trialNumber
  })

export const trialCountFromState = <Config>(state: History.History<Config, Trial.State>): number =>
  SortedMap.size(state.trials)
