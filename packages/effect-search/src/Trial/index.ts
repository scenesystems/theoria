/**
 * Trial data types — configuration, state machine, and lifecycle transitions.
 *
 * @since 0.1.0
 */

export {
  /**
   * The central trial data type representing a single evaluation, including noun-owned lifecycle combinators.
   *
   * @since 0.1.0
   */
  Trial
} from "./model.js"

export {
  /** @since 0.1.0 */ type CompletedTrial,
  /** @since 0.1.0 */ isNumericCompletedTrial,
  /** @since 0.1.0 */ type NumericCompletedTrial
} from "./completed.js"

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
