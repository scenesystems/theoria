/**
 * Immutable Trial data model pairing a sampled configuration with its lifecycle state.
 *
 * @since 0.1.0
 */
import { Data, Match } from "effect"

import type { CompletedState, TrialState } from "./state.js"

/**
 * Immutable record pairing a configuration with its trial number and
 * {@link TrialState}. Study execution creates running trials and replaces
 * them with terminal copies; the class itself does not enforce transitions.
 * `prior` identifies warm-start history, while `cost` is populated only when
 * completion supplies one.
 *
 * @see {@link TrialState} for the five lifecycle variants
 * @see {@link makeRunning} for constructing a running trial
 *
 * @since 0.1.0
 * @category models
 */
export class Trial<Config> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
  readonly state: TrialState
  readonly cost?: number
  readonly prior?: true
}> {}

/**
 * A {@link Trial} statically narrowed to the `Completed` state.
 *
 * @see {@link CompletedState} for the underlying state type
 * @see {@link isNumericCompletedTrial} to further narrow to single-objective results
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletedTrial<Config> = Trial<Config> & {
  readonly state: CompletedState
}

/**
 * A {@link CompletedTrial} whose objective value is a scalar number.
 *
 * @see {@link CompletedTrial} for the broader completed-trial type
 * @see {@link isNumericCompletedTrial} for the runtime guard
 * @see {@link ObjectiveValue} for the full numeric | vector union
 *
 * @since 0.1.0
 * @category type-level
 */
export type NumericCompletedTrial<Config> = CompletedTrial<Config> & {
  readonly state: {
    readonly _tag: "Completed"
    readonly value: number
    readonly duration: number
    readonly retryCount: number
    readonly evaluationCount?: number
    readonly variance?: number
  }
}

/**
 * Narrows a completed trial when its objective value is a scalar number.
 *
 * @see {@link NumericCompletedTrial} for the narrowed type
 * @see {@link CompletedTrial} for the input type
 *
 * @since 0.1.0
 * @category guards
 */
export const isNumericCompletedTrial = <Config>(
  trial: CompletedTrial<Config>
): trial is NumericCompletedTrial<Config> =>
  Match.value(trial.state.value).pipe(
    Match.when(Match.number, () => true),
    Match.orElse(() => false)
  )
