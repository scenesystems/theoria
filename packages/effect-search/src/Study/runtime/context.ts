/**
 * Sampler context construction from canonical study history or hot runtime projection state.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import { type ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import { PendingImputationPolicySpi, type SuggestContext } from "../../Sampler/index.js"
import type { StudyState } from "../state.js"
import { SuggestionState } from "./suggestionState.js"

/**
 * Builds the sampler suggestion context from current study state, applying pending trial imputation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const contextForSuggestion = <Config>(
  objectiveSpec: ObjectiveSpec,
  state: StudyState<Config>,
  priorWeight: number,
  epsilon: number
): Effect.Effect<SuggestContext, never, PendingImputationPolicySpi> =>
  Effect.gen(function*() {
    const policy = yield* PendingImputationPolicySpi
    return SuggestionState.fromStudyState(objectiveSpec, state, priorWeight, epsilon).context({
      name: "effect-search/runtime-derived",
      impute: policy.impute
    })
  })

/**
 * Materializes sampler context from hot runtime projection state.
 *
 * @since 0.3.0
 * @category constructors
 */
export const contextForSuggestionState = (
  state: SuggestionState
): Effect.Effect<SuggestContext, never, PendingImputationPolicySpi> =>
  Effect.gen(function*() {
    const policy = yield* PendingImputationPolicySpi
    return state.context({
      name: "effect-search/runtime-derived",
      impute: policy.impute
    })
  })
