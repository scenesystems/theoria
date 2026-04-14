/**
 * Public effect-search adapter — ask/tell orchestration and progress
 * composition for optimizer integration.
 *
 * @since 0.1.0
 */
import {
  ask as askEffectSearchInterop,
  cancel as cancelEffectSearchInterop,
  fail as failEffectSearchInterop,
  open as openEffectSearchInterop,
  pareto as paretoEffectSearchInterop,
  result as resultEffectSearchInterop,
  resultSummary as resultSummaryEffectSearchInterop,
  Sampler as EffectSearchInteropSampler,
  snapshot as snapshotEffectSearchInterop,
  tell as tellEffectSearchInterop
} from "./askTell.js"
import {
  EffectSearchAcquisitionStrategySchema as EffectSearchAcquisitionStrategySchemaValue,
  EffectSearchInteropEventSchema as EffectSearchInteropEventSchemaValue
} from "./model.js"
import {
  events as effectSearchInteropEvents,
  eventsWithProgress as effectSearchInteropEventsWithProgress
} from "./progress.js"

export {
  askEffectSearchInterop as ask,
  cancelEffectSearchInterop as cancel,
  effectSearchInteropEvents as events,
  effectSearchInteropEventsWithProgress as eventsWithProgress,
  EffectSearchInteropSampler as Sampler,
  failEffectSearchInterop as fail,
  openEffectSearchInterop as open,
  paretoEffectSearchInterop as pareto,
  resultEffectSearchInterop as result,
  resultSummaryEffectSearchInterop as resultSummary,
  snapshotEffectSearchInterop as snapshot,
  tellEffectSearchInterop as tell
}

/**
 * Namespace object that bundles all effect-search adapter operations into a
 * single import for convenience.
 *
 * @since 0.1.0
 * @category constructors
 */
export namespace effectSearchInterop {
  export const EffectSearchAcquisitionStrategySchema: typeof EffectSearchAcquisitionStrategySchemaValue =
    EffectSearchAcquisitionStrategySchemaValue
  export const EffectSearchInteropEventSchema: typeof EffectSearchInteropEventSchemaValue =
    EffectSearchInteropEventSchemaValue
  export const Sampler = EffectSearchInteropSampler
  export const open = openEffectSearchInterop
  export const ask = askEffectSearchInterop
  export const tell = tellEffectSearchInterop
  export const fail = failEffectSearchInterop
  export const cancel = cancelEffectSearchInterop
  export const snapshot = snapshotEffectSearchInterop
  export const result = resultEffectSearchInterop
  export const resultSummary = resultSummaryEffectSearchInterop
  export const events = effectSearchInteropEvents
  export const eventsWithProgress = effectSearchInteropEventsWithProgress
  export const pareto = paretoEffectSearchInterop
}
