/**
 * Runtime-only sampler projection state derived from canonical study history.
 *
 * @since 0.3.0
 */
import { Data, type Option } from "effect"

import type { ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import type { SuggestionDiagnostics } from "../../contracts/SuggestionDiagnostics.js"
import type {
  PendingImputationPolicy,
  SuggestCompletedTrial,
  SuggestContext,
  SuggestPendingTrial
} from "../../Sampler/index.js"
import type { PreparedSuggestionState } from "../../Sampler/preparation.js"
import type * as Trial from "../../Trial/index.js"
import type { StudyState } from "../state.js"
import { contextForSuggestionState, fromStudyStateShape } from "./suggestionStateProjection.js"
import {
  withFinalizedTrialShape,
  withPreparedSuggestionShape,
  withReservedTrialShape
} from "./suggestionStateTransitions.js"

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
}> {
  /**
   * Rehydrates a stable sampler-facing suggestion state from trusted fields.
   *
   * @since 0.3.0
   * @category constructors
   */
  static make(options: ConstructorParameters<typeof SuggestionState>[0]): SuggestionState {
    return new SuggestionState(options)
  }

  /**
   * Projects canonical study history into sampler-facing pending and completed
   * trial observations.
   *
   * @since 0.3.0
   * @category constructors
   */
  static fromStudyState<Config>(
    objectiveSpec: ObjectiveSpec,
    state: StudyState<Config>,
    priorWeight: number,
    epsilon: number
  ): SuggestionState {
    return SuggestionState.make(fromStudyStateShape(objectiveSpec, state, priorWeight, epsilon))
  }

  /**
   * Produces the sampler suggestion context after applying the chosen pending
   * trial imputation policy.
   *
   * @since 0.3.0
   * @category combinators
   */
  context(policy: PendingImputationPolicy): SuggestContext {
    return contextForSuggestionState(this, policy)
  }

  /**
   * Extends the pending trial projection when a new trial number has been
   * reserved but not yet finalized.
   *
   * @since 0.3.0
   * @category combinators
   */
  withReservedTrial<Config>(trial: Trial.Trial<Config>): SuggestionState {
    return SuggestionState.make(withReservedTrialShape(this, trial))
  }

  /**
   * Removes a finalized trial from the pending projection and appends any new
   * completed observation derived from its terminal state.
   *
   * @since 0.3.0
   * @category combinators
   */
  withFinalizedTrial<Config>(trial: Trial.Trial<Config>): SuggestionState {
    return SuggestionState.make(withFinalizedTrialShape(this, trial))
  }

  /**
   * Records the most recent prepared suggestion and its published diagnostics
   * without mutating canonical study history.
   *
   * @since 0.3.0
   * @category combinators
   */
  withPreparedSuggestion(
    preparedSuggestion: Option.Option<PreparedSuggestionState>,
    lastSuggestionDiagnostics: SuggestionDiagnostics
  ): SuggestionState {
    return SuggestionState.make(withPreparedSuggestionShape(this, preparedSuggestion, lastSuggestionDiagnostics))
  }
}
