/**
 * Immutable Trial data model pairing a sampled configuration with its lifecycle state.
 *
 * @since 0.1.0
 */
import { Data, Match } from "effect"

import type { CompletedState, TrialState } from "./state.js"

/**
 * Immutable record pairing a sampler-suggested configuration with its
 * lifecycle state and sequential trial number. A trial progresses through
 * the {@link TrialState} state machine — beginning as `Running` and
 * transitioning exactly once to a terminal state via the lifecycle
 * functions in `Trial/lifecycle.ts`. Because `Trial` extends `Data.Class`,
 * instances use structural equality and are safe to store in `HashMap`.
 *
 * @see {@link TrialState} for the five lifecycle variants
 * @see {@link makeRunning} for the sole entry point that creates a running trial
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
 * single `number` rather than an {@link ObjectiveVector}. This distinction
 * matters for single-objective analysis paths (e.g. best-value tracking,
 * surrogate model fitting) that require a scalar, not a vector.
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
 * Reports whether a completed trial's objective value is a single `number`
 * (as opposed to an {@link ObjectiveVector}). Use this guard to safely
 * narrow into {@link NumericCompletedTrial} before performing scalar
 * operations like comparison or surrogate model fitting.
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
