/**
 * Per-trial optimization context carrying runtime references, stop controls, and pruning policy.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Data, FiberRef, Option } from "effect"

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
export const CurrentTrialContext = FiberRef.unsafeMake<Option.Option<TrialContext>>(Option.none())
