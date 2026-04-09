/**
 * Completed-trial narrowing helpers.
 *
 * @since 0.1.0
 */
import { Match } from "effect"

import type { Trial } from "./model.js"
import type { CompletedState } from "./state.js"

/**
 * Narrowed intersection of {@link Trial} whose state is guaranteed to be
 * `Completed`. Use this type to constrain function parameters to trials
 * that have finished evaluation, providing direct access to the objective
 * value and duration without a runtime guard.
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
 * Further narrowing of {@link CompletedTrial} where the objective value is a
 * single `number` rather than an objective vector. This distinction matters
 * for single-objective analysis paths that require a scalar, not a vector.
 *
 * @see {@link CompletedTrial} for the broader completed-trial type
 * @see {@link isNumericCompletedTrial} for the runtime guard
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
 * Reports whether a completed trial's objective value is a single `number`
 * rather than a multi-objective vector.
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
