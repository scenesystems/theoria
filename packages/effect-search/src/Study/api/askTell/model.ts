/**
 * Data model for the ask/tell study handle and its lifecycle states.
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
 * Opaque handle for manual study orchestration with `ask` / `tell` style workflows.
 *
 * Consumers should treat this as an identity token and use Study combinators
 * (`ask`, `tell`, `fail`, `cancel`, `result`, `snapshot`, `events`) to interact with it.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyHandle<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace> extends Data.Class<{
  readonly [StudyHandleTypeId]: HandleRuntime<Space>
}> {
  /**
   * Wraps a HandleRuntime into an opaque StudyHandle for consumer use.
   *
   * @since 0.1.0
   * @category constructors
   */
  static make<Space extends SearchSpace.SearchSpace>(state: HandleRuntime<Space>): StudyHandle<Space> {
    return new StudyHandle({
      [StudyHandleTypeId]: state
    })
  }
}

/**
 * Reserved trial returned by `Study.ask`.
 *
 * @since 0.1.0
 * @category models
 */
export class AskedTrial<Config = unknown> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
}> {}

/**
 * Extracts the internal HandleRuntime from an opaque StudyHandle.
 *
 * @since 0.1.0
 * @category utils
 */
export const stateOf = <Space extends SearchSpace.SearchSpace>(handle: StudyHandle<Space>): HandleRuntime<Space> =>
  handle[StudyHandleTypeId]

/**
 * Type guard for manual study handles.
 *
 * @since 0.1.0
 * @category guards
 */
export const isStudyHandle = (value: unknown): value is StudyHandle =>
  Predicate.isRecord(value) && Predicate.hasProperty(value, StudyHandleTypeId)
