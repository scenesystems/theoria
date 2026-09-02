/**
 * Immutable trial records and useful completed-trial refinements.
 *
 * @since 0.1.0
 */
import { Data, Match } from "effect"

import type { CompletedState, TrialState } from "./state.js"

/**
 * Stores one evaluated or pending configuration together with its study-assigned
 * number and lifecycle state. Study execution replaces records as trials move
 * between states; direct construction does not validate a transition or any
 * numeric field.
 *
 * @typeParam Config - Decoded configuration evaluated by this trial.
 *
 * @since 0.1.0
 * @category models
 */
export class Trial<Config> extends Data.Class<{
  /** Sequence key assigned by the study. Warm-start trials may use negative values. */
  readonly trialNumber: number
  /** Sampled or decoded configuration passed to the objective. */
  readonly config: Config
  /** Current evaluation state and its outcome metadata. */
  readonly state: TrialState
  /** Caller-defined evaluation cost, when the objective reports one. */
  readonly cost?: number
  /** Set to `true` for warm-start history supplied before execution. */
  readonly prior?: true
}> {}

/**
 * Refines a trial to a successful terminal result while preserving its
 * configuration type.
 *
 * @typeParam Config - Decoded configuration retained by the completed trial.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletedTrial<Config> = Trial<Config> & {
  readonly state: CompletedState
}

/**
 * Refines a completed trial to a scalar objective result. This distinction is
 * used by single-objective ranking and scheduler promotion.
 *
 * @typeParam Config - Decoded configuration retained by the completed trial.
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
 * Narrows a completed trial when its objective value is a JavaScript number
 * rather than a multi-objective vector. The guard does not test finiteness.
 *
 * @typeParam Config - Decoded configuration retained through narrowing.
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
