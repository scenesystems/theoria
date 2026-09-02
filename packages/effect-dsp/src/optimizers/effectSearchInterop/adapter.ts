/**
 * Exposes effect-search ask/tell operations through the DSP optimizer boundary.
 *
 * @since 0.1.0
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
 * Groups the public schemas, study operations, event streams, and Pareto
 * projections used by DSP optimizers.
 *
 * @since 0.1.0
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
