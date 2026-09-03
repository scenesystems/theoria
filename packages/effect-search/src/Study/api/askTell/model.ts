/**
 * Opaque handle and reserved-trial values for manual ask/tell studies.
 *
 * @since 0.1.0
 */
import { Data, Predicate } from "effect"
import type * as PubSub from "effect/PubSub"
import type * as Queue from "effect/Queue"
import type * as Ref from "effect/Ref"

import type * as SearchSpace from "../../../SearchSpace/index.js"
import type * as StudyEvent from "../../../StudyEvent/index.js"
import type { OptimizePlan, OptimizeSettings } from "../../options.js"
import type { StudyRuntime } from "../../runtime/runtimeState.js"

const StudyHandleTypeId = Symbol.for("effect-search/StudyHandle")

/**
 * Internal runtime state for a manual study handle, holding the plan, settings, runtime actor, and event infrastructure.
 *
 * @since 0.1.0
 * @category models
 */
export class HandleRuntime<Space extends SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly settings: OptimizeSettings
  readonly runtime: StudyRuntime<SearchSpace.Type<Space>>
  readonly pubsub: PubSub.PubSub<StudyEvent.StudyEvent>
  readonly eventQueue: Queue.Dequeue<StudyEvent.StudyEvent>
  readonly completionPublishedRef: Ref.Ref<boolean>
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
export class StudyHandle<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> extends Data.Class<{
  readonly [StudyHandleTypeId]: HandleRuntime<Space>
}> {}

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
    [StudyHandleTypeId]: state
  })

/**
 * Extracts the internal HandleRuntime from an opaque StudyHandle.
 *
 * @since 0.1.0
 * @category utils
 */
export const stateOf = <Space extends SearchSpace.SearchSpace>(handle: StudyHandle<Space>): HandleRuntime<Space> =>
  handle[StudyHandleTypeId]

/**
 * Checks for the package-global private handle symbol used by manual studies.
 * The shallow check recognizes handles created by compatible package copies but
 * does not inspect the enclosed runtime or its lifecycle.
 *
 * @since 0.1.0
 * @category guards
 */
export const isStudyHandle = (value: unknown): value is StudyHandle =>
  Predicate.isRecord(value) && Predicate.hasProperty(value, StudyHandleTypeId)
