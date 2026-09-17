/** Optimization-specific queries over native effect-study history. */
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Boolean as Bool, Equal, Match, Number as Num, Option, SortedMap } from "effect"

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
    onSome: ([trialNumber]) => Num.max(Num.negate(1), trialNumber)
  })

export const freshTrialCountFromState = <Config>(state: History.History<Config, Trial.State>): number =>
  Arr.length(Arr.filter(History.values(state), (trial) => Bool.not(Equal.equals(trial.prior, true))))

/** Terminalizes abandoned reservations without changing observations or their identities. */
export const cancelPendingTrials = <Config>(state: History.History<Config, Trial.State>) =>
  History.fromIterable(
    Arr.map(History.values(state), (trial) =>
      Match.value(Trial.isState("Running")(trial.state)).pipe(
        Match.when(true, () => Trial.cancel(trial)),
        Match.orElse(() => trial)
      ))
  )
