/**
 * Study runtime initialization and restoration from persisted state.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import type { Lifecycle } from "@scenesystems/effect-study/Lifecycle"
import { Array as Arr, Data, Effect, Option, Ref, SubscriptionRef } from "effect"

import type * as StudyEvent from "../../../StudyEvent.js"
import type * as Trial from "../../../Trial.js"
import { bestValueFromTrials } from "../best.js"
import type { EventPublisher } from "../events.js"
import { noopEventPublisher } from "../events.js"
import type { OptimizeSettings } from "../options/plan.js"
import { singleDirectionFromSettings } from "../options/settings.js"
import { makeStopRef, type StopRef } from "./controls.js"

/**
 * Composite state pairing the lifecycle phase with the inner study trial data.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeState<Config = unknown> extends Data.Class<{
  readonly lifecycle: Lifecycle
  readonly studyState: History.History<Config, Trial.State>
}> {}

/**
 * Search runtime carrying serialized state, stop controls, ranking state, and event publication.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyRuntime<Config = unknown> extends Data.Class<{
  readonly state: SubscriptionRef.SubscriptionRef<RuntimeState<Config>>
  readonly stopRef: StopRef
  readonly completionReasonRef: Ref.Ref<Option.Option<StudyEvent.CompletionReason>>
  readonly bestValueRef: Ref.Ref<Option.Option<number>>
  readonly noImprovementCountRef: Ref.Ref<number>
  readonly eventPublisher: EventPublisher
}> {}

const initialRuntimeState = <Config>(initialTrials: Iterable<Trial.Trial<Config>>): RuntimeState<Config> =>
  new RuntimeState({
    lifecycle: "Created",
    studyState: History.fromIterable(initialTrials)
  })

const makeRuntime = <Config>(
  settings: OptimizeSettings,
  state: RuntimeState<Config>,
  eventPublisher: EventPublisher
): Effect.Effect<StudyRuntime<Config>> =>
  Effect.gen(function*() {
    return new StudyRuntime({
      state: yield* SubscriptionRef.make(state),
      stopRef: yield* makeStopRef,
      completionReasonRef: yield* Ref.make<Option.Option<StudyEvent.CompletionReason>>(Option.none()),
      bestValueRef: yield* Ref.make<Option.Option<number>>(
        Option.match(singleDirectionFromSettings(settings), {
          onNone: () => Option.none(),
          onSome: (direction) => bestValueFromTrials(direction, History.values(state.studyState))
        })
      ),
      noImprovementCountRef: yield* Ref.make(0),
      eventPublisher
    })
  })

/**
 * Constructs a fresh study runtime from initial settings and optional prior trials.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initializeRuntime = <Config>(
  settings: OptimizeSettings,
  initialTrials: Iterable<Trial.Trial<Config>> = Arr.empty(),
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>> => makeRuntime(settings, initialRuntimeState(initialTrials), eventPublisher)

/**
 * Restores the lifecycle and history from a runtime snapshot into a fresh serialized reference.
 *
 * @since 0.1.0
 * @category constructors
 */
export const restoreRuntime = <Config>(
  settings: OptimizeSettings,
  snapshot: RuntimeState<Config>,
  eventPublisher: EventPublisher = noopEventPublisher
): Effect.Effect<StudyRuntime<Config>> => makeRuntime(settings, snapshot, eventPublisher)
