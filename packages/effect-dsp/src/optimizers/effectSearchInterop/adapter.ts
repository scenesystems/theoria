/**
 * Public effect-search adapter — ask/tell orchestration and progress
 * composition for optimizer integration.
 *
 * @since 0.0.0
 */
import { ask, cancel, fail, makeTpeSampler, open, pareto, result, resultSummary, snapshot, tell } from "./askTell.js"
import { EffectSearchAcquisitionStrategySchema, EffectSearchInteropEventSchema } from "./model.js"
import { events, eventsWithProgress } from "./progress.js"

export {
  ask,
  cancel,
  events,
  eventsWithProgress,
  fail,
  makeTpeSampler,
  open,
  pareto,
  result,
  resultSummary,
  snapshot,
  tell
}

/**
 * Namespace object that bundles all effect-search adapter operations into a
 * single import for convenience.
 *
 * @since 0.0.0
 * @category constructors
 */
export const effectSearchInterop = {
  EffectSearchAcquisitionStrategySchema,
  EffectSearchInteropEventSchema,
  makeTpeSampler,
  open,
  ask,
  tell,
  fail,
  cancel,
  snapshot,
  result,
  resultSummary,
  events,
  eventsWithProgress,
  pareto
}
