/**
 * Trial records and pure lifecycle transitions used by study execution and
 * persistence. The transition functions create copies and do not check that
 * the input trial is running.
 *
 * @since 0.1.0
 */

export {
  cancel,
  complete,
  completeWithRetryCount,
  completeWithRetryCountAndCost,
  fail,
  makeRunning,
  prune
} from "./lifecycle.js"

export { type CompletedTrial, isNumericCompletedTrial, type NumericCompletedTrial, Trial } from "./model.js"

export {
  Cancelled,
  Completed,
  type CompletedState,
  Failed,
  isState,
  matchState,
  Pruned,
  Running,
  type TrialState
} from "./state.js"
