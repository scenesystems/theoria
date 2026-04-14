/**
 * State-transition helpers for the sampler-facing suggestion state.
 *
 * @since 0.3.0
 */
import { Array as Arr, Number as Num, Option, Order } from "effect"

import type { SuggestCompletedTrial, SuggestPendingTrial } from "../../Sampler/index.js"
import type { PreparedSuggestionState } from "../../Sampler/preparation.js"
import type * as Trial from "../../Trial/index.js"
import type { SuggestionState } from "./suggestionState.js"
import { completedProjectionForTrial, toSuggestPendingTrial } from "./suggestionStateProjection.js"

const SuggestTrialOrder = Order.mapInput(
  Order.number,
  (trial: SuggestCompletedTrial | SuggestPendingTrial) => trial.trialNumber
)

const insertByTrialNumber = <A extends SuggestCompletedTrial | SuggestPendingTrial>(
  values: ReadonlyArray<A>,
  next: A
): Array<A> => Arr.sort(Arr.append(values, next), SuggestTrialOrder)

const removeByTrialNumber = <A extends SuggestCompletedTrial | SuggestPendingTrial>(
  values: ReadonlyArray<A>,
  trialNumber: number
): Array<A> => Arr.filter(values, (candidate) => candidate.trialNumber !== trialNumber)

/**
 * Projects a reserved trial into the pending portion of the suggestion state.
 *
 * @since 0.3.0
 * @category projections
 */
export const withReservedTrialShape = <Config>(
  state: SuggestionState,
  trial: Trial.Trial<Config>
): ConstructorParameters<typeof SuggestionState>[0] => ({
  observedCompleted: state.observedCompleted,
  pending: insertByTrialNumber(state.pending, toSuggestPendingTrial(trial)),
  objectiveSpec: state.objectiveSpec,
  priorWeight: state.priorWeight,
  epsilon: state.epsilon,
  nextTrialNumber: Num.max(state.nextTrialNumber, Num.increment(trial.trialNumber)),
  preparedSuggestion: state.preparedSuggestion
})

/**
 * Projects a finalized trial into pending/completed sampler state without
 * mutating the canonical trial ledger.
 *
 * @since 0.3.0
 * @category projections
 */
export const withFinalizedTrialShape = <Config>(
  state: SuggestionState,
  trial: Trial.Trial<Config>
): ConstructorParameters<typeof SuggestionState>[0] => ({
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
  preparedSuggestion: state.preparedSuggestion
})

/**
 * Stores the prepared suggestion cache alongside the sampler-facing
 * projection state.
 *
 * @since 0.3.0
 * @category projections
 */
export const withPreparedSuggestionShape = (
  state: SuggestionState,
  preparedSuggestion: Option.Option<PreparedSuggestionState>
): ConstructorParameters<typeof SuggestionState>[0] => ({
  observedCompleted: state.observedCompleted,
  pending: state.pending,
  objectiveSpec: state.objectiveSpec,
  priorWeight: state.priorWeight,
  epsilon: state.epsilon,
  nextTrialNumber: state.nextTrialNumber,
  preparedSuggestion
})
