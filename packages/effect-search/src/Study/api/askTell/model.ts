/**
 * Opaque handle and reserved-trial values for manual ask/tell studies.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"
import type { Mailbox, SynchronizedRef } from "effect"

import type * as SearchSpace from "../../../SearchSpace/index.js"
import type * as StudyEvent from "../../../StudyEvent/index.js"
import type { OptimizePlan, OptimizeSettings } from "../../options.js"
import type { StudyRuntime } from "../../runtime/runtimeState.js"

/**
 * Internal runtime state for a manual study handle, holding the plan, settings, serialized state, and event infrastructure.
 *
 * @since 0.1.0
 * @category models
 */
export class HandleRuntime<Space extends SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly settings: OptimizeSettings
  readonly runtime: StudyRuntime<SearchSpace.Type<Space>>
  readonly eventQueue: Mailbox.Mailbox<StudyEvent.StudyEvent>
  readonly completionPublishedRef: SynchronizedRef.SynchronizedRef<boolean>
}> {}

/**
 * Owns the mutable runtime and event queue for one in-process manual study. Use
 * the ask/tell operations to access it. The handle cannot be serialized or
 * reconstructed in another process, and its resources remain bound to the
 * scope in which {@link open} created it.
 *
 * @typeParam Space - Search-space schema that determines each reserved configuration.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyHandle<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace>
  extends Data.TaggedClass("effect-search/StudyHandle")<{
    readonly runtime: HandleRuntime<Space>
  }>
{}

/**
 * Identifies a configuration reserved for external evaluation. The trial stays
 * pending until the same number is passed to {@link tell} or {@link fail}.
 *
 * @typeParam Config - Decoded configuration reserved for evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class AskedTrial<Config = unknown> extends Data.Class<{
  /** Study-assigned key required by `tell` and `fail`. */
  readonly trialNumber: number
  /** Decoded configuration to evaluate outside the study runtime. */
  readonly config: Config
}> {}

/**
 * Wraps a HandleRuntime into an opaque StudyHandle for consumer use.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeStudyHandle = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): StudyHandle<Space> =>
  new StudyHandle({
    runtime: state
  })

/**
 * Extracts the internal HandleRuntime from an opaque StudyHandle.
 *
 * @since 0.1.0
 * @category utils
 */
export const stateOf = <Space extends SearchSpace.SearchSpace>(handle: StudyHandle<Space>): HandleRuntime<Space> =>
  handle.runtime

/**
 * Recognizes handles constructed by this module, not records that merely copy
 * the tag. This does not check whether the handle's scope is still open.
 *
 * @since 0.1.0
 * @category guards
 */
export const isStudyHandle = Schema.is(Schema.instanceOf(StudyHandle))
