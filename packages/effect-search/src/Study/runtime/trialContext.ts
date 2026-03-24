/**
 * Per-trial context carrying runtime references, stop controls, and pruning policy.
 *
 * @since 0.1.0
 */
import { Data, FiberRef, Option } from "effect"

import type { EventRuntime } from "../events.js"
import type { ReportRefs, StopRef } from "./controls/model.js"
import type { PruningPolicy, StopMode } from "./pruning.js"

/**
 * Per-trial context carrying references to the study runtime, stop controls, report refs, and pruning policy.
 *
 * @since 0.1.0
 * @category models
 */
export class TrialContext extends Data.Class<{
  readonly trialNumber: number
  readonly studyRuntime: EventRuntime
  readonly stopRef: StopRef
  readonly reportRefs: ReportRefs
  readonly stopMode: StopMode
  readonly pruningPolicy: PruningPolicy
  readonly resource: Option.Option<number>
}> {}

/**
 * Fiber-local reference holding the current trial's context, enabling the objective runtime to access trial-scoped state.
 *
 * @since 0.1.0
 * @category models
 */
export const CurrentTrialContext = FiberRef.unsafeMake<Option.Option<TrialContext>>(Option.none())
