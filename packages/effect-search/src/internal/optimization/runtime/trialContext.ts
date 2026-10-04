/**
 * Per-trial optimization context carrying runtime references, stop controls, and pruning policy.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Context, Data, Option } from "effect"

import type { Policy } from "../../../Pruning.js"
import type { EventRuntime } from "../events.js"
import type { ReportRefs, StopRef } from "./controls/reportState.js"

/**
 * Per-trial context carrying references to the optimization runtime, stop controls, report refs, and pruning policy.
 *
 * @since 0.1.0
 * @category models
 */
export class TrialContext extends Data.Class<{
  readonly trialNumber: number
  readonly eventRuntime: EventRuntime
  readonly stopRef: StopRef
  readonly reportRefs: ReportRefs
  readonly stopMode: Stop.Mode
  readonly pruningPolicy: Policy
  readonly resource: Option.Option<number>
}> {}

/**
 * Fiber-local reference holding the current trial's context, enabling the objective runtime to access trial-scoped state.
 *
 * @since 0.1.0
 * @category models
 */
export const CurrentTrialContext = Context.Reference<Option.Option<TrialContext>>(
  "@scenesystems/effect-search/internal/optimization/CurrentTrialContext",
  { defaultValue: () => Option.none() }
)
