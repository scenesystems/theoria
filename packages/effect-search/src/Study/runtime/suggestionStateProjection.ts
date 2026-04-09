/**
 * Pure projection helpers for the sampler-facing suggestion state.
 *
 * @since 0.3.0
 */
import { Array as Arr, Number as Num, Option, Predicate } from "effect"

import type { ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import {
  type PendingImputationPolicy,
  SuggestCompletedTrial,
  SuggestContext,
  SuggestPendingTrial
} from "../../Sampler/index.js"
import * as Trial from "../../Trial/index.js"
import { completedTrialsFromState, maxTrialNumberFromState, pendingTrialsFromState, type StudyState } from "../state.js"
import type { SuggestionState } from "./suggestionState.js"

const toSamplerConfig = <Config>(config: Config): SamplerConfig => Predicate.isRecord(config) ? config : {}

const trialVariance = <Config>(trial: Trial.CompletedTrial<Config>): Option.Option<number> =>
  Option.fromNullable(trial.state.variance)

const toSuggestCompletedTrial = <Config>(
  trial: Trial.CompletedTrial<Config>,
  priorWeight: number
): SuggestCompletedTrial =>
  Option.match(trialVariance(trial), {
    onNone: () =>
      SuggestCompletedTrial.fromObservation(
        trial.trialNumber,
        toSamplerConfig(trial.config),
        trial.state.value,
        trial.prior === true ? priorWeight : 1,
        trial.cost
      ),
    onSome: (variance) =>
      SuggestCompletedTrial.fromObservation(
        trial.trialNumber,
        toSamplerConfig(trial.config),
        trial.state.value,
        trial.prior === true ? priorWeight : 1,
        trial.cost,
        variance
      )
  })

/**
 * Projects a reserved or running trial into the sampler-pending observation
 * surface.
 *
 * @since 0.3.0
 * @category projections
 */
export const toSuggestPendingTrial = <Config>(trial: Trial.Trial<Config>): SuggestPendingTrial =>
  SuggestPendingTrial.make({
    trialNumber: trial.trialNumber,
    config: toSamplerConfig(trial.config)
  })

/**
 * Projects a finalized trial into the sampler-completed observation surface.
 *
 * Running, pruned, cancelled, and failed trials remain absent because they do
 * not contribute an objective value to the sampler history.
 *
 * @since 0.3.0
 * @category projections
 */
export const completedProjectionForTrial = <Config>(
  trial: Trial.Trial<Config>,
  priorWeight: number
): Option.Option<SuggestCompletedTrial> =>
  Trial.matchState({
    Running: () => Option.none(),
    Pruned: () => Option.none(),
    Failed: () => Option.none(),
    Cancelled: () => Option.none(),
    Completed: ({ value, variance }) =>
      Option.some(
        SuggestCompletedTrial.fromObservation(
          trial.trialNumber,
          toSamplerConfig(trial.config),
          value,
          trial.prior === true ? priorWeight : 1,
          trial.cost,
          variance
        )
      )
  })(trial.state)

/**
 * Derives the full sampler-facing shape from canonical study state in one
 * projection step.
 *
 * @since 0.3.0
 * @category projections
 */
export const fromStudyStateShape = <Config>(
  objectiveSpec: ObjectiveSpec,
  state: StudyState<Config>,
  priorWeight: number,
  epsilon: number
): ConstructorParameters<typeof SuggestionState>[0] => ({
  observedCompleted: Arr.map(
    completedTrialsFromState(state),
    (trial) => toSuggestCompletedTrial(trial, priorWeight)
  ),
  pending: Arr.map(pendingTrialsFromState(state), toSuggestPendingTrial),
  objectiveSpec,
  priorWeight,
  epsilon,
  nextTrialNumber: Num.increment(maxTrialNumberFromState(state)),
  preparedSuggestion: Option.none(),
  lastSuggestionDiagnostics: Option.none()
})

const imputedCompleted = (
  state: SuggestionState,
  policy: PendingImputationPolicy
): Array<SuggestCompletedTrial> => {
  const baseContext = SuggestContext.make({
    completed: Arr.fromIterable(state.observedCompleted),
    pending: Arr.fromIterable(state.pending),
    objectiveSpec: state.objectiveSpec,
    nextTrialNumber: state.nextTrialNumber,
    epsilon: state.epsilon
  })

  return Arr.map(
    policy.impute(baseContext),
    (observation) =>
      SuggestCompletedTrial.fromObservation(
        observation.trialNumber,
        observation.config,
        observation.value
      )
  )
}

/**
 * Builds the suggestion context consumed by samplers after pending-trial
 * imputations have been expanded into completed observations.
 *
 * @since 0.3.0
 * @category projections
 */
export const contextForSuggestionState = (
  state: SuggestionState,
  policy: PendingImputationPolicy
): SuggestContext =>
  SuggestContext.make({
    completed: Arr.appendAll(state.observedCompleted, imputedCompleted(state, policy)),
    pending: Arr.fromIterable(state.pending),
    objectiveSpec: state.objectiveSpec,
    nextTrialNumber: state.nextTrialNumber,
    epsilon: state.epsilon
  })
