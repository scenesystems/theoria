/**
 * Trial data types — configuration, state machine, and lifecycle transitions.
 *
 * @since 0.1.0
 */

export {
  /**
   * Transition a running trial to cancelled state.
   *
   * @since 0.1.0
   */
  cancel,
  /**
   * Transition a running trial to completed state with objective values.
   *
   * @since 0.1.0
   */
  complete,
  /** @since 0.1.0 */ completeWithRetryCount,
  /** @since 0.1.0 */ completeWithRetryCountAndCost,
  /**
   * Transition a running trial to failed state.
   *
   * @since 0.1.0
   */
  fail,
  /**
   * Construct a new trial in the running state.
   *
   * @since 0.1.0
   */
  makeRunning,
  /**
   * Transition a running trial to pruned state.
   *
   * @since 0.1.0
   */
  prune
} from "./lifecycle.js"

export {
  /** @since 0.1.0 */ type CompletedTrial,
  /** @since 0.1.0 */ isNumericCompletedTrial,
  /** @since 0.1.0 */ type NumericCompletedTrial,
  /**
   * The central trial data type representing a single evaluation.
   *
   * @since 0.1.0
   */
  Trial
} from "./model.js"

export {
  /** @since 0.1.0 @category constructors */ Cancelled,
  /** @since 0.1.0 @category constructors */ Completed,
  /** @since 0.1.0 */ type CompletedState,
  /** @since 0.1.0 @category constructors */ Failed,
  /** @since 0.1.0 @category guards */ isState,
  /** @since 0.1.0 @category pattern-matching */ matchState,
  /** @since 0.1.0 @category constructors */ Pruned,
  /** @since 0.1.0 @category constructors */ Running,
  /** @since 0.1.0 */ type TrialState
} from "./state.js"
