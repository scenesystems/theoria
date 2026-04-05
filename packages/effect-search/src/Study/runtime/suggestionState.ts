/**
 * Runtime-only sampler projection state derived from canonical study history.
 *
 * @since 0.3.0
 */
import { Array as Arr, Data, Number as Num, Option, Order, Predicate } from "effect"

import type { ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import type { SamplerConfig } from "../../internal/configAccess.js"
import {
  makeSuggestCompletedTrial,
  makeSuggestPendingTrial,
  type PendingImputationPolicy,
  type SuggestCompletedTrial,
  SuggestContext,
  type SuggestPendingTrial
} from "../../Sampler/index.js"
import type { PreparedSuggestionState, SuggestionDiagnostics } from "../../Sampler/preparation.js"
import * as Trial from "../../Trial/index.js"
import { completedTrialsFromState, maxTrialNumberFromState, pendingTrialsFromState, type StudyState } from "../state.js"

const SuggestTrialOrder = Order.mapInput(
  Order.number,
  (trial: SuggestCompletedTrial | SuggestPendingTrial) => trial.trialNumber
)

const toSamplerConfig = <Config>(config: Config): SamplerConfig => Predicate.isRecord(config) ? config : {}

const trialVariance = <Config>(trial: Trial.CompletedTrial<Config>): Option.Option<number> =>
  Option.fromNullable(trial.state.variance)

const toSuggestCompletedTrial = <Config>(
  trial: Trial.CompletedTrial<Config>,
  priorWeight: number
): SuggestCompletedTrial =>
  Option.match(trialVariance(trial), {
    onNone: () =>
      makeSuggestCompletedTrial(
        trial.trialNumber,
        toSamplerConfig(trial.config),
        trial.state.value,
        trial.prior === true ? priorWeight : 1,
        trial.cost
      ),
    onSome: (variance) =>
      makeSuggestCompletedTrial(
        trial.trialNumber,
        toSamplerConfig(trial.config),
        trial.state.value,
        trial.prior === true ? priorWeight : 1,
        trial.cost,
        variance
      )
  })

const toSuggestPendingTrial = <Config>(trial: Trial.Trial<Config>): SuggestPendingTrial =>
  makeSuggestPendingTrial(trial.trialNumber, toSamplerConfig(trial.config))

const insertByTrialNumber = <A extends SuggestCompletedTrial | SuggestPendingTrial>(
  values: ReadonlyArray<A>,
  next: A
): Array<A> => Arr.sort(Arr.append(values, next), SuggestTrialOrder)

const removeByTrialNumber = <A extends SuggestCompletedTrial | SuggestPendingTrial>(
  values: ReadonlyArray<A>,
  trialNumber: number
): Array<A> => Arr.filter(values, (candidate) => candidate.trialNumber !== trialNumber)

const completedProjectionForTrial = <Config>(
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
        makeSuggestCompletedTrial(
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
 * Runtime-only projection of canonical study history into sampler-facing state.
 *
 * @since 0.3.0
 * @category models
 */
export class SuggestionState extends Data.Class<{
  readonly observedCompleted: ReadonlyArray<SuggestCompletedTrial>
  readonly pending: ReadonlyArray<SuggestPendingTrial>
  readonly objectiveSpec: ObjectiveSpec
  readonly priorWeight: number
  readonly epsilon: number
  readonly nextTrialNumber: number
  readonly preparedSuggestion: Option.Option<PreparedSuggestionState>
  readonly lastSuggestionDiagnostics: Option.Option<SuggestionDiagnostics>
}> {}

/**
 * Rebuilds sampler-facing projection state from canonical study history.
 *
 * @since 0.3.0
 * @category constructors
 */
export const suggestionStateFromStudyState = <Config>(
  objectiveSpec: ObjectiveSpec,
  state: StudyState<Config>,
  priorWeight: number,
  epsilon: number
): SuggestionState =>
  new SuggestionState({
    observedCompleted: Arr.map(completedTrialsFromState(state), (trial) => toSuggestCompletedTrial(trial, priorWeight)),
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
  const baseContext = new SuggestContext({
    completed: Arr.fromIterable(state.observedCompleted),
    pending: Arr.fromIterable(state.pending),
    objectiveSpec: state.objectiveSpec,
    nextTrialNumber: state.nextTrialNumber,
    epsilon: state.epsilon
  })

  return Arr.map(
    policy.impute(baseContext),
    (observation) =>
      makeSuggestCompletedTrial(
        observation.trialNumber,
        observation.config,
        observation.value
      )
  )
}

/**
 * Materializes the current sampler context from hot runtime projection state.
 *
 * @since 0.3.0
 * @category constructors
 */
export const suggestContextFromSuggestionState = (
  state: SuggestionState,
  policy: PendingImputationPolicy
): SuggestContext =>
  new SuggestContext({
    completed: Arr.appendAll(state.observedCompleted, imputedCompleted(state, policy)),
    pending: Arr.fromIterable(state.pending),
    objectiveSpec: state.objectiveSpec,
    nextTrialNumber: state.nextTrialNumber,
    epsilon: state.epsilon
  })

/**
 * Updates runtime projection state after reserving a new running trial.
 *
 * @since 0.3.0
 * @category combinators
 */
export const withReservedTrialSuggestionState = <Config>(
  state: SuggestionState,
  trial: Trial.Trial<Config>
): SuggestionState =>
  new SuggestionState({
    observedCompleted: state.observedCompleted,
    pending: insertByTrialNumber(state.pending, toSuggestPendingTrial(trial)),
    objectiveSpec: state.objectiveSpec,
    priorWeight: state.priorWeight,
    epsilon: state.epsilon,
    nextTrialNumber: Num.max(state.nextTrialNumber, Num.increment(trial.trialNumber)),
    preparedSuggestion: state.preparedSuggestion,
    lastSuggestionDiagnostics: state.lastSuggestionDiagnostics
  })

/**
 * Updates runtime projection state after a pending trial finalizes.
 *
 * @since 0.3.0
 * @category combinators
 */
export const withFinalizedTrialSuggestionState = <Config>(
  state: SuggestionState,
  trial: Trial.Trial<Config>
): SuggestionState =>
  new SuggestionState({
    observedCompleted: Option.match(completedProjectionForTrial(trial, state.priorWeight), {
      onNone: () => state.observedCompleted,
      onSome: (completed) =>
        insertByTrialNumber(removeByTrialNumber(state.observedCompleted, trial.trialNumber), completed)
    }),
    pending: removeByTrialNumber(state.pending, trial.trialNumber),
    objectiveSpec: state.objectiveSpec,
    priorWeight: state.priorWeight,
    epsilon: state.epsilon,
    nextTrialNumber: state.nextTrialNumber,
    preparedSuggestion: state.preparedSuggestion,
    lastSuggestionDiagnostics: state.lastSuggestionDiagnostics
  })

/**
 * Updates runtime-only prepared suggestion state and the latest suggestion diagnostics.
 *
 * @since 0.3.0
 * @category combinators
 */
export const withPreparedSuggestionState = (
  state: SuggestionState,
  preparedSuggestion: Option.Option<PreparedSuggestionState>,
  lastSuggestionDiagnostics: SuggestionDiagnostics
): SuggestionState =>
  new SuggestionState({
    observedCompleted: state.observedCompleted,
    pending: state.pending,
    objectiveSpec: state.objectiveSpec,
    priorWeight: state.priorWeight,
    epsilon: state.epsilon,
    nextTrialNumber: state.nextTrialNumber,
    preparedSuggestion,
    lastSuggestionDiagnostics: Option.some(lastSuggestionDiagnostics)
  })
